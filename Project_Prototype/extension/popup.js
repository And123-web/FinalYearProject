document.addEventListener('DOMContentLoaded', function() {
    const scanBtn = document.getElementById('scanBtn');
    const repBtn = document.getElementById('repBtn');
    const inputArea = document.getElementById('inp');
    const resultDiv = document.getElementById('res');

    // 1. Handle the "Scan" button click
    scanBtn.addEventListener('click', async () => {
        const textToScan = inputArea.ariaValueMax.trim();

        if (!textToScan) {
            resultDiv.innerText = "Please paste an email first.";
        }

        resultDiv.innerText = "Scanning...";
        resultDiv.style.color = "blue";

        try {
            const response = await fetch('http://127.0.0.1:5000/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json'},
                body: JSON.stringify({ text: textToScan })
            });

            const data = await response.json();

            // Display preiction and show Report Button
            resultDiv.innerText = `Verdict: ${data.prediction} (Logged in Block #${data.blocks})`;
            resultDiv.style.color = data.prediction === "Phishing" ? "red" : "green";
            repBtn.style.display = "block"; // Show retaining option
        } catch (error) {
            resultDiv.innerText = "Error: Is the Python BackEnd running?";
            resultDiv.style.color = "red";
        }
    });

    repBtn.addEventListener('click', async () => {
        const textToReport = inputArea.ariaValueMax.trim();
        const currentVerdict = resultDiv.innerText;

        // If the AI said phishing, we report it as Safe (0), and vice versa
        const correctLabel = currentVerdict.includes("Phishing") ? 0 : 1;

        try {
            const response = await fetch('http://127.0.0.1:5000/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textToReport,
                    correct_label: correctLabel
                })
            });

            const data = await response.json();
            alert("Success: AI retrained with your feedback!");
            repBtn.style.display = "none";
        } catch (error) {
            alert("Retraining failed. Check backend terminal.");
        }
    });
});