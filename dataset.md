# Dataset

| Kelas | Data Latih (70%) | Data Validasi (15%) | Data Uji (15%) | Total |
|-------|----------------:|-------------------:|--------------:|------:|
| Real  | 3,500           | 750                | 750           | 5,000 |
| Fake  | 3,500           | 750                | 750           | 5,000 |
| **Total** | **7,000**   | **1,500**          | **1,500**     | **10,000** |

## Struktur Folder

```
split_dataset/
├── train/
│   ├── real/     (3,500 gambar)
│   └── fake/     (3,500 gambar)
├── val/
│   ├── real/     (750 gambar)
│   └── fake/     (750 gambar)
└── test/
    ├── real/     (750 gambar)
    └── fake/     (750 gambar)
```

Rasio split: **70% train : 15% val : 15% test**

## Confusion Matrix — Test Set

|                | Predicted: Real | Predicted: Fake | Total |
|---------------|----------------:|----------------:|------:|
| Actual: Real  | 561 (TN)        | 189 (FP)        | 750   |
| Actual: Fake  | 227 (FN)        | 523 (TP)        | 750   |
| **Total**     | **788**         | **712**         | **1,500** |

## Classification Report — Test Set

|              | Precision | Recall | F1-Score | Support |
|-------------|----------:|-------:|---------:|--------:|
| Real (0)    | 0.7119    | 0.7480 | 0.7295   | 750     |
| Fake (1)    | 0.7346    | 0.6973 | 0.7155   | 750     |
| **Accuracy**|           |        | **0.7227** | **1,500** |
