import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const parseTransaction = async (rawText) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
You are a financial transaction parser.

Return ONLY valid JSON. No explanation.

JSON Schema:
{
  "merchant": string,
  "amount": number,
  "currency": string,
  "date": string,
  "transaction_type": string,
  "reference_number": string,
  "account_number": string,
  "bank_name": string,
  "category": string
}

Rules:
- Convert date to YYYY-MM-DD
- Amount must be number only
- If missing, return null

Message:
"""
${rawText}
"""
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean response (sometimes comes with ```json)
    const cleanText = text.replace(/```json|```/g, "").trim();

    return JSON.parse(cleanText);
  } catch (err) {
    console.error("Gemini Error:", err);
    return null;
  }
};