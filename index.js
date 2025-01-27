require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Bem-vindo ao meu projeto Node.js!");
});

// Busca o cliente pelo email
app.get("/customers", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const customers = await stripe.customers.list({ email });
    if (customers.data.length > 0) {
      const customer = customers.data[0];
      return res.status(200).json({ id: customer.id, email: customer.email });
    }

    return res.status(404).json({ message: "Customer not found" });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// Cria cliente e realiza pagamento
app.post("/payment-sheet", async (req, res) => {
  try {
    const { name, email, phone, amount } = req.body;

    if (!name || !email || !amount) {
      return res
        .status(400)
        .json({ error: "Name, email, and amount are required" });
    }

    // Verificar se o cliente já existe
    let customer;
    const customers = await stripe.customers.list({ email });
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      // Criar novo cliente
      customer = await stripe.customers.create({ name, email, phone });
    }

    // Criar ephemeral key
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: "2024-12-18.acacia" }
    );

    // Criar intenção de pagamento
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "brl",
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
    });

    // Retornar resposta ao frontend
    res.status(200).json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      publishableKey: process.env.STRIPE_PUBLIC_KEY,
    });
  } catch (error) {
    console.error("Error creating payment sheet:", error);
    res.status(500).json({ error: "Failed to create payment sheet" });
  }
});

// Remove cliente pelo ID
app.delete("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    const deleted = await stripe.customers.del(id);
    res.status(200).json(deleted);
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

// Iniciar o servidor
app.listen(3000, () => console.log("Server started on port 3000"));
