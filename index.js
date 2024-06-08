const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.udmqtzd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

const port = process.env.PORT || 5000;

// Middleware
app.use(
	cors({
		origin: ["http://localhost:5173"],
		credentials: true,
	})
);
app.use(express.json());

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		// await client.connect();
		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);

		const userCollection = client
			.db("B9A12-Medicine-E-Commerce")
			.collection("users");
		const productCollection = client
			.db("B9A12-Medicine-E-Commerce")
			.collection("products");
		const categoryCollection = client
			.db("B9A12-Medicine-E-Commerce")
			.collection("categories");
		// const userCollection  = client.db("B9A12-Medicine-E-Commerce")


    const verifyToken = (req, res, next) => {
      const token = req.cookies.token;
    
      console.log("token in the middleware", token);
    
      if (!token) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
    
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
    
        req.user = decoded;
        next();
      });
    };

		app.post("/jwt", async (req, res) => {
			try {
				const user = req.body;
				const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
					expiresIn: "1h",
				});

				res.cookie("token", token, {
					httpOnly: true,
					// secure: process.env.NODE_ENV === "production",
					secure: false,
					sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
				});
			} catch (error) {
				res.send({
					status: true,
					error: error.message,
				});
			}
		});

		app.post("/logout", async (req, res) => {
			const user = req.body;
			res
				.clearCookie("token", {
					maxAge: 0,
					// secure: process.env.NODE_ENV === "production" ? true : false,
					secure: false,
					sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
				})
				.send({ status: true });
		});
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}


app.get('/', (req, res) => {
  res.send("Server is running")
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})