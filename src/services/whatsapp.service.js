// src/services/whatsapp.service.js

async function callWhatsAppAPI(payload) {
  const token = process.env.META_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const version = process.env.GRAPH_API_VERSION || "v22.0";

  if (!token || !phoneNumberId) {
    throw new Error("Faltan META_TOKEN o PHONE_NUMBER_ID en .env");
  }

  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error enviando a WhatsApp:", data);
    throw new Error(data?.error?.message || "No se pudo enviar mensaje a WhatsApp");
  }

  return data;
}

async function sendWhatsAppText(to, text) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

async function sendWhatsAppButtons(to, bodyText, buttons) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: bodyText,
      },
      action: {
        buttons: buttons.map((btn, index) => ({
          type: "reply",
          reply: {
            id: btn.id || `btn_${index + 1}`,
            title: btn.title,
          },
        })),
      },
    },
  });
}

async function sendWhatsAppList(to, bodyText, buttonText, sections) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: bodyText,
      },
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}

module.exports = {
  sendWhatsAppText,
  sendWhatsAppButtons,
  sendWhatsAppList,
};