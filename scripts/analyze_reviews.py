#!/usr/bin/env python3
import csv
import io
import json
import sys
from collections import Counter

import nltk
from nltk.sentiment import SentimentIntensityAnalyzer

POSITIVE = "positive"
NEGATIVE = "negative"
NEUTRAL = "neutral"

def ensure_vader():
    try:
        return SentimentIntensityAnalyzer()
    except LookupError:
        nltk.download("vader_lexicon", quiet=True)
        return SentimentIntensityAnalyzer()

def normalize_label(value):
    value = str(value).strip().lower()
    if value in {"positive", "pos", "1"}:
        return POSITIVE
    if value in {"negative", "neg", "0"}:
        return NEGATIVE
    if value in {"neutral", "neu"}:
        return NEUTRAL
    return value

def classify(compound):
    if compound >= 0.05:
        return POSITIVE
    if compound <= -0.05:
        return NEGATIVE
    return NEUTRAL

def main():
    if "--single" in sys.argv:
        sia = ensure_vader()
        review = sys.stdin.read()
        scores = sia.polarity_scores(review)
        print(json.dumps({"review": review, "compound": scores["compound"], "predicted": classify(scores["compound"]), "scores": scores}, ensure_ascii=False))
        return

    raw = sys.stdin.read()
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        raise ValueError("The CSV file has no header row.")
    fields = {field.strip().lower(): field for field in reader.fieldnames if field}
    review_field = fields.get("review") or fields.get("text") or fields.get("sentence")
    sentiment_field = fields.get("sentiment") or fields.get("label") or fields.get("polarity")
    if not review_field or not sentiment_field:
        raise ValueError("CSV must contain review and sentiment columns.")

    sia = ensure_vader()
    rows = []
    actual_counts = Counter()
    predicted_counts = Counter()
    correct = 0
    for index, row in enumerate(reader):
        review = (row.get(review_field) or "").strip()
        actual = normalize_label(row.get(sentiment_field, ""))
        if actual not in {POSITIVE, NEGATIVE, NEUTRAL}:
            actual = str(row.get(sentiment_field, "")).strip().lower() or "unknown"
        scores = sia.polarity_scores(review)
        compound = scores["compound"]
        predicted = classify(compound)
        actual_counts[actual] += 1
        predicted_counts[predicted] += 1
        if actual == predicted:
            correct += 1
        rows.append({
            "id": index + 1,
            "review": review,
            "actual": actual,
            "compound": compound,
            "predicted": predicted,
        })

    labels = [NEGATIVE, NEUTRAL, POSITIVE]
    matrix = {actual: {predicted: 0 for predicted in labels} for actual in labels}
    for row in rows:
        if row["actual"] in matrix:
            matrix[row["actual"]][row["predicted"]] += 1

    f1_values = []
    for label in labels:
        tp = matrix[label][label]
        fp = sum(matrix[other][label] for other in labels if other != label)
        fn = sum(matrix[label][other] for other in labels if other != label)
        precision = tp / (tp + fp) if tp + fp else 0
        recall = tp / (tp + fn) if tp + fn else 0
        f1_values.append((2 * precision * recall / (precision + recall)) if precision + recall else 0)

    total = len(rows)
    result = {
        "metrics": {
            "total": total,
            "accuracy": correct / total if total else 0,
            "macroF1": sum(f1_values) / len(labels) if labels else 0,
            "actualCounts": dict(actual_counts),
            "predictedCounts": {label: predicted_counts[label] for label in labels},
        },
        "matrix": matrix,
        "rows": rows,
    }
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
