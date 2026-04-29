import sys, json, base64, os
import joblib
import warnings

# Hide background warnings
warnings.filterwarnings("ignore") 

# 1. Figure out exactly where this ml_predict.py script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Build the exact paths to look INSIDE the machinelearningmodel folder
MODEL_PATH = os.path.join(BASE_DIR, 'machinelearningmodel', 'phishing_model.pkl')
VEC_PATH = os.path.join(BASE_DIR, 'machinelearningmodel', 'vectorizer.pkl')

# 3. Load the brains using the new paths
try:
    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VEC_PATH)
except Exception as e:
    # If it fails, print the exact error back to Node.js so we can see it
    print(json.dumps({"error": f"Model load error: {str(e)}"}))
    sys.exit(1)

def analyze_email(content_b64):
    email_body = base64.b64decode(content_b64).decode('utf-8')
    vec_text = vectorizer.transform([email_body])

    prediction_string = model.predict(vec_text)[0]
    probabilities = model.predict_proba(vec_text)[0]
    confidence = float(max(probabilities))

    if prediction_string == "Phishing Email":
        label = "Phishing"
        if confidence < 0.75:
            label = "Suspicious"
    else:
        label = "Safe"

    return {"classification": label, "confidence": confidence}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(analyze_email(sys.argv[1])))