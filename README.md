# SplitSnap

**Snap, Split, Settle!**

SplitSnap is an intelligent, AI-powered web application that takes the friction out of splitting complex bills. Instead of manually typing out every item from a crumpled dinner or grocery receipt, SplitSnap uses Google's Gemini Vision API to instantly extract all items, prices, and taxes.

Simply upload a photo of your receipt, and SplitSnap will digitize it. You can verify the items, assign them to your friends, and the app will perfectly calculate each person's exact share—including proportional tax splits—ready to be settled.

![Dependencies](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Dependencies](https://img.shields.io/badge/FastAPI-0.100+-teal?logo=fastapi)
![Dependencies](https://img.shields.io/badge/Gemini-2.5_Flash-blue?logo=google)

### Link:
https://splitsnap-web.vercel.app/

---

## 🚀 How it Works
1. **Snap**: Upload a clear photo of your receipt (JPEG, PNG, WEBP).
2. **AI Extraction**: The FastAPI backend sends the image to Gemini 2.5 Flash, which instantly decodes the items, prices, and total tax, even deciphering cryptic supermarket abbreviations.
3. **Split**: Enter the names of your friends and simply tap the items they shared. SplitSnap dynamically calculates the subtotal and their proportional tax slice.

## 🛠️ Tech Stack
This project is built using a modern, decoupled architecture:

* **Frontend**: Next.js 16 (React 19), styled with Tailwind CSS v4 and Shadcn UI components.
* **Backend**: Python FastAPI, utilizing Pydantic for strict JSON schema validation.
* **AI Engine**: Google GenAI SDK (Gemini 2.5 Flash) for highly constrained, lightning-fast OCR extraction.

## 🛡️ Security & Guardrails
SplitSnap was built with strict protections to safeguard its internal API pipeline:
* **Prompt Injection Prevention**: The AI is strictly instructed to ignore any commands or text written on the uploaded image.
* **Content Filtering**: If an uploaded image is not a recognizable receipt or invoice, the system forces a strict `{"error": "INVALID_RECEIPT"}` circuit-breaker, rejecting the image before processing.
* **Data Minimization**: The AI is explicitly bounded to never extract or output Personally Identifiable Information (PII) such as credit card numbers or phone numbers from the receipt.
* **Rate Limiting**: The FastAPI backend utilizes `slowapi` to restrict endpoints to 5 requests per minute per IP address, preventing spam and brute-force exhaustion of the AI free-tier.
* **Strict Schema Validation**: Responses from Gemini are passed through strict Pydantic models. If the AI deviates from the exact JSON structure required by the frontend, the transaction is safely aborted.

---

## 💻 Local Development

Before you begin, you will need a free Google AI API key: [Google AI Studio](https://aistudio.google.com/)

### 1. Start the Backend (FastAPI)
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # On Windows
pip install -r requirements.txt

# Create a .env file and add:
# GEMINI_API_KEY=your_key_here

uvicorn main:app --reload
```

### 2. Start the Frontend (Next.js)
```bash
cd frontend
npm install

# Create a .env file and add:
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```
Open `http://localhost:3000` to view the app.