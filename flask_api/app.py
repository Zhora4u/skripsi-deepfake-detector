import os
import re
import time

os.environ['TZ'] = 'Asia/Jakarta'
time.tzset()

# Batasi thread TensorFlow agar tidak overload CPU/RAM
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["TF_NUM_INTEROP_THREADS"] = "2"
os.environ["TF_NUM_INTRAOP_THREADS"] = "2"

import csv
from io import StringIO
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import tensorflow as tf
from tensorflow.keras.utils import img_to_array
import numpy as np
import io
import os
import base64
import binascii
from PIL import Image
try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False
    MySQLError = Exception
from datetime import datetime
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# ─── GradCAM ─────────────────────────────────

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 30 * 1024 * 1024
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*").split(",")}})

@app.errorhandler(413)
def request_entity_too_large(e):
    return jsonify({'error': 'Ukuran file melebihi batas maksimal 20MB setelah encoding base64.'}), 413


ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'}
ALLOWED_MIMES = {'image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'}
MAX_FILE_SIZE = 20 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATHS = [
    ('xception_final', os.path.join(BASE_DIR, 'xception_final.keras')),
]

models = {}
for model_key, model_path in MODEL_PATHS:
    if os.path.exists(model_path):
        try:
            model = tf.keras.models.load_model(model_path, compile=False)
            models[model_key] = model
            print(f"[INFO] Model loaded: {model_key} from {model_path}")
        except Exception as e:
            print(f"[WARN] Failed to load {model_key}: {e}")


def get_db_connection():
    if not MYSQL_AVAILABLE:
        return None
    try:
        conn = mysql.connector.connect(
            host=os.getenv('MYSQL_HOST', 'localhost'),
            port=int(os.getenv('MYSQL_PORT', '3306')),
            user=os.getenv('MYSQL_USER', 'appuser'),
            password=os.getenv('MYSQL_PASSWORD', 'apppassword'),
            database=os.getenv('MYSQL_DATABASE', 'deepfake_detector'),
        )
        return conn
    except MySQLError as e:
        print(f"[WARN] MySQL connection failed: {e}")
        return None


def init_database():
    conn = get_db_connection()
    if conn is None:
        print("[WARN] Database not available, skipping init")
        return
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255),
                prediction VARCHAR(10),
                confidence FLOAT,
                raw_score FLOAT,
                image_size INT,
                image_format VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255),
                prediction VARCHAR(10),
                confidence FLOAT,
                correct BOOLEAN NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        print("[INFO] Database initialized successfully")
    except MySQLError as e:
        print(f"[WARN] Database init failed: {e}")
    finally:
        try:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()
        except:
            pass


def save_prediction(filename, result, confidence, raw_score, img_bytes):
    conn = get_db_connection()
    if conn is None:
        return
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO predictions (filename, prediction, confidence, raw_score, image_size, image_format)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            filename or 'unknown',
            result,
            confidence,
            raw_score,
            len(img_bytes) if img_bytes else 0,
            'image',
        ))
        conn.commit()
    except MySQLError as e:
        print(f"[WARN] Failed to save prediction: {e}")
    finally:
        try:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()
        except:
            pass


def validate_file_type(filename, mime_type=None):
    if not filename:
        return True, None
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if ext in {'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'}:
        return False, 'File video tidak didukung langsung. Gunakan fitur upload video di halaman utama untuk ekstraksi frame.'
    if ext not in ALLOWED_EXTENSIONS:
        return False, f'Format file "{ext}" tidak didukung. Gunakan: {", ".join(sorted(ALLOWED_EXTENSIONS))}'
    if mime_type and mime_type not in ALLOWED_MIMES and not mime_type.startswith('image/'):
        return False, 'Tipe file tidak dikenali sebagai gambar.'
    return True, None


def validate_image_bytes(img_bytes, filename=None):
    if not img_bytes:
        raise ValueError('File kosong.')
    if len(img_bytes) > MAX_FILE_SIZE:
        raise ValueError(f'Ukuran file ({len(img_bytes) / 1024 / 1024:.1f}MB) melebihi batas maksimal 20MB.')
    try:
        with Image.open(io.BytesIO(img_bytes)) as test_img:
            test_img.verify()
    except Exception:
        raise ValueError('File tidak dapat dikenali sebagai gambar. Format tidak valid atau file rusak.')


def detect_face(img_bytes):
    if not CV2_AVAILABLE:
        raise ValueError('Deteksi wajah tidak tersedia (OpenCV tidak terinstall).')
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('Gagal mendekode gambar untuk deteksi wajah.')
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade_front = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    cascade_profile = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    faces_front = cascade_front.detectMultiScale(gray, 1.1, 3, minSize=(50, 50))
    faces_profile = cascade_profile.detectMultiScale(gray, 1.1, 3, minSize=(50, 50))
    return len(faces_front) + len(faces_profile) > 0


def load_image_from_bytes(img_bytes):
    if not img_bytes:
        raise ValueError('Image is empty')
    img = Image.open(io.BytesIO(img_bytes))
    img = img.convert('RGB')
    img = img.resize((299, 299))
    x = img_to_array(img)
    x = np.expand_dims(x, axis=0) / 255.0
    return x


def _normalize(img):
    return img.astype(np.float32) / 255.0


def compute_gradcam(model, img_array, original_img):
    """
    Grad-CAM:
    - Cari layer konvolusional terakhir dari model
    - Hitung gradien prediksi terhadap feature maps
    - Weight feature maps dengan global-average-pooled gradients
    - Hasilkan heatmap overlay
    """
    import time
    t0 = time.time()

    # Resize original untuk overlay agar Grad-CAM cepat (max 1024px)
    MAX_OVERLAY = 1024
    ow, oh = original_img.size
    if ow > MAX_OVERLAY or oh > MAX_OVERLAY:
        if ow > oh:
            oh = int((oh / ow) * MAX_OVERLAY); ow = MAX_OVERLAY
        else:
            ow = int((ow / oh) * MAX_OVERLAY); oh = MAX_OVERLAY
        original_img = original_img.resize((ow, oh), Image.BILINEAR)

    orig_np = np.array(original_img.convert('RGB'))
    orig_w, orig_h = original_img.size

    # Cari layer konvolusional terakhir (Keras 3 compat)
    from tensorflow.keras.layers import Conv2D, SeparableConv2D, DepthwiseConv2D
    CONV_LAYERS = (Conv2D, SeparableConv2D, DepthwiseConv2D)
    last_conv_layer = None
    for layer in reversed(model.layers):
        if isinstance(layer, CONV_LAYERS):
            last_conv_layer = layer
            break

    if last_conv_layer is None:
        raise ValueError("Tidak menemukan layer convolutional untuk Grad-CAM")

    # Sub-model: output feature maps + prediksi
    grad_model = tf.keras.models.Model(
        inputs=model.input,
        outputs=[last_conv_layer.output, model.output]
    )

    # Gradient tape
    with tf.GradientTape() as tape:
        conv_output, predictions = grad_model(img_array)
        loss = predictions[:, 0]

    grads = tape.gradient(loss, conv_output)
    pooled_grads = tf.reduce_mean(grads, axis=(1, 2))

    # Weighted combination of feature maps
    heatmap = tf.reduce_sum(
        pooled_grads[:, tf.newaxis, tf.newaxis, :] * conv_output, axis=-1
    )[0]
    heatmap = tf.maximum(heatmap, 0)
    heatmap /= (tf.reduce_max(heatmap) + 1e-8)
    heatmap = heatmap.numpy()

    # Resize ke ukuran asli
    if CV2_AVAILABLE:
        imp_resized = cv2.resize(heatmap, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
    else:
        imp_resized = np.array(
            Image.fromarray((heatmap * 255).astype(np.uint8)).resize((orig_w, orig_h), Image.BILINEAR)
        ).astype(np.float32) / 255.0

    # Overlay heatmap
    overlay = orig_np.astype(np.float32) / 255.0
    if CV2_AVAILABLE:
        imp_colored = cv2.applyColorMap(
            (imp_resized * 255).astype(np.uint8), cv2.COLORMAP_JET
        ).astype(np.float32) / 255.0
    else:
        imp_colored = np.stack([imp_resized * 255] * 3, axis=-1).astype(np.uint8).astype(np.float32) / 255.0

    blended = cv2.addWeighted(overlay, 0.5, imp_colored, 0.5, 0) if CV2_AVAILABLE else (
        overlay * 0.5 + imp_colored * 0.5
    )
    blended = (np.clip(blended, 0, 1) * 255).astype(np.uint8)

    buffered = io.BytesIO()
    Image.fromarray(blended).save(buffered, format='JPEG', quality=90)
    heatmap_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

    # ── Region importance breakdown ──────────────────────────
    h_full, w_full = imp_resized.shape
    regions = []

    # Compute 4x4 grid from full heatmap
    grid_rows, grid_cols = 4, 4
    cell_h, cell_w = h_full // grid_rows, w_full // grid_cols
    grid_labels = [
        ['kiri-atas', 'tengah-atas', 'kanan-atas', 'kanan-jauh'],
        ['kiri-tengah', 'tengah', 'kanan-tengah', 'kanan-jauh-tengah'],
        ['kiri-bawah-tengah', 'bawah-tengah', 'kanan-bawah-tengah', 'kanan-bawah-jauh'],
        ['kiri-bawah', 'bawah', 'kanan-bawah', 'bawah-jauh'],
    ]
    grid_regions = []
    for r in range(grid_rows):
        for c in range(grid_cols):
            y1, y2 = r * cell_h, (r + 1) * cell_h if r < grid_rows - 1 else h_full
            x1, x2 = c * cell_w, (c + 1) * cell_w if c < grid_cols - 1 else w_full
            region_imp = float(imp_resized[y1:y2, x1:x2].mean())
            grid_regions.append({
                'name': grid_labels[r][c],
                'importance': round(region_imp, 4),
            })

    # Try face-based regions as fallback (merging grid cells in face area)
    if CV2_AVAILABLE:
        gray = cv2.cvtColor(orig_np, cv2.COLOR_RGB2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, 1.1, 3, minSize=(100, 100))
        if len(faces) > 0:
            fx, fy, fw, fh = faces[0]
            imp_face = imp_resized[fy:fy+fh, fx:fx+fw]
            face_mean = float(imp_face.mean())

            if face_mean > 0.001:
                face_regions = {
                    'dahi': (0.1, 0.0, 0.8, 0.2),
                    'mata-kiri': (0.05, 0.2, 0.35, 0.4),
                    'mata-kanan': (0.55, 0.2, 0.9, 0.4),
                    'hidung': (0.3, 0.35, 0.7, 0.6),
                    'mulut': (0.2, 0.6, 0.8, 0.85),
                    'dagu': (0.2, 0.8, 0.8, 1.0),
                }

                for region_name, (rx1, ry1, rx2, ry2) in face_regions.items():
                    rx1_px = int(rx1 * fw)
                    ry1_px = int(ry1 * fh)
                    rx2_px = int(rx2 * fw)
                    ry2_px = int(ry2 * fh)
                    if rx1_px < rx2_px and ry1_px < ry2_px:
                        region_imp = float(imp_face[ry1_px:ry2_px, rx1_px:rx2_px].mean())
                        regions.append({
                            'name': region_name,
                            'importance': round(region_imp, 4),
                        })

                if regions:
                    regions.sort(key=lambda r: r['importance'], reverse=True)

    # Fallback: use grid if face regions empty or all zero
    if not regions or all(r['importance'] < 0.001 for r in regions):
        regions = sorted(grid_regions, key=lambda r: r['importance'], reverse=True)

    elapsed = round(time.time() - t0, 2)
    pred_val = predictions.numpy()

    return {
        'heatmap_url': f'data:image/jpeg;base64,{heatmap_b64}',
        'baseline_score': round(float(pred_val[0][0]), 4),
        'regions': regions,
        'elapsed': elapsed,
    }


@app.route('/predict', methods=['POST'])
def predict():
    try:
        filename = None
        save_history = False
        if 'image' in request.files:
            file = request.files['image']
            img_bytes = file.read()
            filename = file.filename
            mime_type = file.content_type
            is_valid, msg = validate_file_type(filename, mime_type)
            if not is_valid:
                return jsonify({'error': msg}), 400
        elif request.is_json:
            data = request.get_json()
            if not isinstance(data, dict):
                return jsonify({'error': 'Invalid JSON body'}), 400
            save_history = data.get('save_history', False)
            filename = data.get('filename', filename)
            image_data = data.get('image', '')
            if image_data.startswith('data:'):
                mime_match = re.match(r'data:(\w+/[\w.+-]+)', image_data)
                mime_type = mime_match.group(1) if mime_match else None
                if mime_type and mime_type.startswith('video/'):
                    return jsonify({'error': 'File video tidak didukung langsung. Gunakan fitur upload video di halaman utama untuk ekstraksi frame.'}), 400
                if mime_type and mime_type not in ALLOWED_MIMES and not mime_type.startswith('image/'):
                    return jsonify({'error': f'Tipe file "{mime_type}" tidak didukung. Gunakan file gambar.'}), 400
                _, encoded = image_data.split(',', 1)
                img_bytes = base64.b64decode(encoded, validate=True)
            else:
                return jsonify({'error': 'Format data gambar tidak valid.'}), 400
        else:
            return jsonify({'error': 'Tidak ada file gambar yang dikirimkan.'}), 400

        try:
            validate_image_bytes(img_bytes, filename)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        try:
            has_face = detect_face(img_bytes)
            if not has_face:
                return jsonify({'error': 'Tidak ada wajah terdeteksi pada gambar. Hanya gambar yang mengandung wajah yang dapat dianalisis.'}), 400
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        if not models:
            return jsonify({
                'status': 'success',
                'prediction': 'REAL',
                'confidence': 0.5,
                'raw_score': 0.5,
                'note': 'No model loaded. Using placeholder result.',
            })

        x = load_image_from_bytes(img_bytes)

        scores = {}
        for key, m in models.items():
            pred = m.predict(x, verbose=0)
            scores[key] = float(pred[0][0])

        # Ensemble: rata-rata raw score dari semua model (1=REAL, 0=FAKE)
        avg_score = sum(scores.values()) / len(scores)
        confidence = max(avg_score, 1 - avg_score)
        result = "REAL" if (avg_score > 0.5 and confidence >= 0.7) else "FAKE"

        save_prediction(filename, result, round(confidence, 4), round(avg_score, 4), img_bytes)

        return jsonify({
            'status': 'success',
            'prediction': result,
            'confidence': round(confidence, 4),
            'raw_score': round(avg_score, 4),
        })
    except (ValueError, binascii.Error, Image.UnidentifiedImageError) as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/explain', methods=['POST'])
def explain():
    print("[EXPLAIN] Request received")
    try:
        # ── Parse input (same as /predict) ──────────────────────
        filename = None
        if 'image' in request.files:
            file = request.files['image']
            img_bytes = file.read()
            filename = file.filename
            mime_type = file.content_type
            is_valid, msg = validate_file_type(filename, mime_type)
            if not is_valid:
                return jsonify({'error': msg}), 400
        elif request.is_json:
            data = request.get_json()
            if not isinstance(data, dict):
                return jsonify({'error': 'Invalid JSON body'}), 400
            image_data = data.get('image', '')
            if image_data.startswith('data:'):
                _, encoded = image_data.split(',', 1)
                img_bytes = base64.b64decode(encoded, validate=True)
            else:
                return jsonify({'error': 'Format data gambar tidak valid.'}), 400
        else:
            return jsonify({'error': 'Tidak ada file gambar yang dikirimkan.'}), 400

        validate_image_bytes(img_bytes, filename)
        has_face = detect_face(img_bytes)
        if not has_face:
            return jsonify({'error': 'Tidak ada wajah terdeteksi pada gambar.'}), 400

        if not models:
            return jsonify({'error': 'Model tidak tersedia.'}), 503

        # ── Prediction ──────────────────────────────────────────
        x = load_image_from_bytes(img_bytes)
        original_img = Image.open(io.BytesIO(img_bytes)).convert('RGB')

        scores = {}
        for key, m in models.items():
            pred = m.predict(x, verbose=0)
            scores[key] = float(pred[0][0])

        avg_score = sum(scores.values()) / len(scores)
        confidence = max(avg_score, 1 - avg_score)
        result = "REAL" if (avg_score > 0.5 and confidence >= 0.7) else "FAKE"

        # ── Grad-CAM ───────────────────────────────────────────
        model = list(models.values())[0]
        gradcam_result = compute_gradcam(model, x, original_img)

        return jsonify({
            'status': 'success',
            'prediction': result,
            'confidence': round(confidence, 4),
            'raw_score': round(avg_score, 4),
            'heatmap': gradcam_result['heatmap_url'],
            'baseline_score': gradcam_result['baseline_score'],
            'regions': gradcam_result['regions'],
            'elapsed': gradcam_result['elapsed'],
        })
    except (ValueError, binascii.Error, Image.UnidentifiedImageError) as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'models_loaded': list(models.keys()),
        'ensemble_count': len(models),
    })


@app.route('/model-info', methods=['GET'])
def model_info():
    try:
        first = list(models.values())[0] if models else None
        return jsonify({
            'architecture': 'XceptionNet',
            'input_size': '299x299x3',
            'total_params': int(sum(np.prod(w.shape) for w in first.weights)) if first else 0,
            'ensemble': list(models.keys()),
            'strategy': 'average ensemble + low confidence default FAKE',
            'threshold': 0.5,
            'confidence_min': 0.7,
            'status': 'ok',
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/history', methods=['GET'])
def get_history():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'Database tidak tersedia'}), 503
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, filename, prediction, confidence, raw_score, image_size, created_at FROM predictions ORDER BY created_at DESC")
        rows = cursor.fetchall()
        for row in rows:
            if isinstance(row.get('created_at'), datetime):
                row['created_at'] = row['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        return jsonify(rows)
    except MySQLError as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()
        except:
            pass


@app.route('/history/download', methods=['GET'])
def download_history():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'Database tidak tersedia'}), 503
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, filename, prediction, confidence, raw_score, image_size, created_at FROM predictions ORDER BY created_at DESC")
        rows = cursor.fetchall()

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['No', 'Nama File', 'Prediction', 'Confidence', 'Raw Score', 'Ukuran (bytes)', 'Timestamp'])
        for i, row in enumerate(rows, 1):
            writer.writerow([
                i,
                row.get('filename', ''),
                row.get('prediction', ''),
                row.get('confidence', ''),
                row.get('raw_score', ''),
                row.get('image_size', 0),
                row['created_at'].strftime('%Y-%m-%d %H:%M:%S') if isinstance(row.get('created_at'), datetime) else str(row.get('created_at', '')),
            ])

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=riwayat_deteksi.csv'},
        )
    except MySQLError as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()
        except:
            pass


@app.route('/feedback', methods=['POST'])
def submit_feedback():
    try:
        data = request.get_json()
        if not isinstance(data, dict):
            return jsonify({'error': 'Invalid JSON body'}), 400

        correct = data.get('correct')
        if correct is None or not isinstance(correct, bool):
            return jsonify({'error': 'Field "correct" wajib diisi dengan boolean (true/false).'}), 400

        conn = get_db_connection()
        if conn is None:
            return jsonify({'error': 'Database tidak tersedia'}), 503

        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO feedback (filename, prediction, confidence, correct)
            VALUES (%s, %s, %s, %s)
        """, (
            data.get('filename', 'unknown'),
            data.get('prediction', ''),
            data.get('confidence', 0),
            correct,
        ))
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Feedback saved'})
    except MySQLError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()
        except:
            pass


@app.route('/feedback-stats', methods=['GET'])
def feedback_stats():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'Database tidak tersedia'}), 503
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT COUNT(*) as total FROM predictions")
        total_predictions = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as total FROM feedback")
        total_feedback = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as total FROM feedback WHERE correct = TRUE")
        total_correct = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as total FROM feedback WHERE correct = FALSE")
        total_incorrect = cursor.fetchone()['total']

        cursor.execute("""
            SELECT id, filename, prediction, confidence, correct, created_at
            FROM feedback ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        for row in rows:
            if isinstance(row.get('created_at'), datetime):
                row['created_at'] = row['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            row['correct'] = bool(row['correct'])

        return jsonify({
            'total_predictions': total_predictions,
            'total_feedback': total_feedback,
            'total_correct': total_correct,
            'total_incorrect': total_incorrect,
            'feedback': rows,
        })
    except MySQLError as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            if conn and conn.is_connected():
                cursor.close()
                conn.close()
        except:
            pass


@app.route('/reset-data', methods=['GET'])
def reset_data():
    if not MYSQL_AVAILABLE:
        return jsonify({'error': 'Database tidak tersedia'}), 503
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("TRUNCATE TABLE predictions")
        cursor.execute("TRUNCATE TABLE feedback")
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Semua data berhasil dihapus'})
    except MySQLError as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            if cursor: cursor.close()
            if conn and conn.is_connected(): conn.close()
        except:
            pass

init_database()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=os.getenv('FLASK_DEBUG') == '1')
