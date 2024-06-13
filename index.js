require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
	cors({
		origin: [
			"http://localhost:5173",
			"https://healthsphere-9f7cf.web.app",
			"https://healthsphere-9f7cf.firebaseapp.com",
		],
		credentials: true,
	})
);
app.use(express.json());
app.use(cookieParser());

const cookieOptions = {
	httpOnly: true,
	sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
	secure: process.env.NODE_ENV === "production" ? true : false,
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.udmqtzd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});
async function run() {
	try {
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

		app.post("/jwt", async (req, res) => {
			const user = req.body;
			// console.log(user);

			const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
				expiresIn: "1h",
			});

			res.cookie("token", token, cookieOptions).send({ success: true });
		});

		app.post("/logout", async (req, res) => {
			const user = req.body;
			res
				.clearCookie("token", {
					...cookieOptions,
					maxAge: 0,
				})
				.send({ success: true });
		});

		app.post("/users", async (req, res) => {
			const newUser = req.body;
			// console.log(newUser);
			if (!(await userCollection.findOne({ email: newUser.email }))) {
				const result = await userCollection.insertOne(newUser);
				// console.log(result);
				res.send(result);
			}
			res.send({ message: 'user already exists', insertedId: null })
		});

		app.get("/users", async (req, res) => {
			const cursor = userCollection.find();
			const result = await cursor.toArray();
			res.send(result);
		});

		app.get("/categories", async (req, res) => {
			const result = await categoryCollection.find().toArray();
			res.send(result)
		})

		app.get(`/categories/:slug`, async (req, res) => {
			const {slug} = req.params
			const categoryDetails = await categoryCollection.findOne({slug})
			console.log(categoryDetails.productIds)
			const categoryProducts = await productCollection.find({_id: {$in: categoryDetails.productIds}}).toArray()
			console.log({...categoryDetails, categoryProducts})
			res.send({...categoryDetails, categoryProducts})
		})

		app.get("/products", async (req, res) => {
			const queries = req.query;
			const result = await productCollection
				.find({
					// category_name: queries?.category_name? queries.category_name : { $exists: true }
					...queries,
				})
				.toArray();
			console.log(result);
			res.send(result);
		});


		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
	}
}
run().catch(console.dir);

app.get(`/`, (req, res) => {
	res.send("Server is running");
});

app.listen(port, () => {
	console.log(`Server is running on port: ${port}`);
});
