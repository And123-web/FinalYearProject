import webview
import threading
from app import app # Uses your existing backend

def run_logic():
    app.run(port=5000)

if __name__ == '__main__':
    threading.Thread(target=run_logic, daemon=True).start()
    webview.create_window('ShieldAI Desktop', 'dashboard.html')
    webview.start()