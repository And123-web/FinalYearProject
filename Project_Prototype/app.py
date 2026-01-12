import hashlib, json, time
from flask import Flask, request, jsonify
from flask_cors import flask_cors
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB

app = Flask(__name__)
CORS(app)

# --- ML Setup ---
vectorizer = CountVectorizer()
model = MultinomialNB()

def train_model():
    with open('email.json', 'r') as f:
        data = json.load(f)
    texts, label = [i['text'] for i in data], [i['label'] for i in data]
    model.fit(vectorizer.fit_transform(texts), labels)

# --- Blockchain Setup ---
class AuditChain:
    def __init__(self):
        self.chain = [{"index": 0, "hash": "0", "data": "Genesis"}]
    def add_block(self, data):
        prev_hash = self.chain[-1]['hash']
        block = {"index": len(self.chain), "prev": prev_hash, "data": data}
        block['hash'] = hashlib.sha256(str(block).encode()).hexdigest()
        self.chain.append(block)

audit = AuditChain()
train_model()

@app.route('/scan', methods=['POST'])
def scan():
    text = request.json.get('text')
    prediction = int(model.predict(vectorizer.transform([text])[0]))
    res = "Phishing" if prediction == 1 else "Safe"
    audit.add_block({"scan": text[:20], "result": res})
    return jsonify({"prediction": res, "blocks": len(audit.chain)})

@app.route('/report', methods=['POST'])
def report():
    with open('email.json', 'r+') as f:
        data = json.load(f)
        data.append({"text": request.json['text'], "label": request.json['correct_label']})
        f.seek(0); json.dump(data, f, indent=4)
    train_model()
    return jsonify({"status": "Retrained"})

@app.route('/dashboard_data')
def get_logs(): return jsonify(audit.chain)

if __name__ = '__main__': app.run(port=5000)
