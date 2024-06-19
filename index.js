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
		const cartCollection = client
			.db("B9A12-Medicine-E-Commerce")
			.collection("carts");

		app.post("/jwt", async (req, res) => {
			const user = req.body;
			// console.log(user);

			const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
				expiresIn: "9999999h",
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

		// middlewares
		const verifyToken = (req, res, next) => {
			console.log("got hit in verity token");
			const token = req?.cookies?.token;
			if (!token)
				return res.status(401).send({ message: "Unauthorized access" });
			jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
				if (err) return res.status(403).send({ message: "Forbidden access" });
				req.decoded = decoded;
				next();
			});
		};

		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			const isAdmin = user?.role === "admin";
			if (!isAdmin)
				return res.status(403).send({ message: "Forbidden access" });
			next();
		};

		app.post("/users", async (req, res) => {
			const newUser = req.body;
			// console.log(newUser);
			if (!(await userCollection.findOne({ user_email: newUser.user_email }))) {
				const result = await userCollection.insertOne(newUser);
				// console.log(result);
				res.send(result);
			} else {
				res.send({ message: "user already exists", insertedId: null });
			}
		});

		app.get("/users", async (req, res) => {
			const cursor = userCollection.find();
			const result = await cursor.toArray();
			res.send(result);
		});

		app.get("/categories", async (req, res) => {
			const result = await categoryCollection.find().toArray();
			res.send(result);
		});

		app.get(`/categories/:slug`, async (req, res) => {
			const { slug } = req.params;
			const categoryDetails = await categoryCollection.findOne({ slug });
			console.log(categoryDetails.productIds);
			const categoryProducts = await productCollection
				.find({ _id: { $in: categoryDetails.productIds } })
				.toArray();
			console.log({ ...categoryDetails, categoryProducts });
			res.send({ ...categoryDetails, categoryProducts });
		});

		app.get("/update-categories", async (req, res) => {
			const categories = await categoryCollection.find().toArray();
			const products = await productCollection.find().toArray();
			categories.forEach(async (category) => {
				const categoryProducts = products.filter(
					(product) => product.category_name === category.name
				);
				const productIds = categoryProducts.map((product) => product._id);
				await categoryCollection.updateOne(
					{ name: category.name },
					{ $set: { productIds } }
				);
			});
			res.send({ success: true });
		});

		app.get("/update-products", async (req, res) => {
			await productCollection.updateMany(
				{},
				{ $unset: { product_category: 1 } },
				{ multi: true }
			);
		});

		app.get("/products", async (req, res) => {
			const queries = req.query;
			const result = await productCollection
				.find({
					// category_name: queries?.category_name? queries.category_name : { $exists: true }
					...queries,
				})
				.toArray();
			// console.log(result);
			res.send(result);
		});

		app.get("/carts", verifyToken, async (req, res) => {
			if (req.decoded.email !== req.query.email) {
				console.log(req.decoded.user_email, req.query.email);
				return res.status(403).send({ message: "Forbidden access" });
			}
			const cart = await cartCollection.findOne({
				user_email: req.query.email,
			});
			// const result = await Promise.all(cart.cartItems.map(async (item) => {
			// 	const product = await productCollection.findOne({
			// 		_id: new ObjectId(item.productId),
			// 	});
			// 	return { product, quantity: item.quantity };
			// }));

			const result = await productCollection
				.find({
					_id: {
						$in: cart.cartItems.map((item) => new ObjectId(item.productId)),
					},
				})
				.toArray();

			result.forEach((product) => {
				product.quantity = cart.cartItems.find(
					(item) => item.productId === product._id.toString()
				).quantity;
			});
			res.send({ _id: cart._id, user_email: cart.user_email, items: result });
		});
		//
		app.post("/carts", verifyToken, async (req, res) => {
			const newItem = req.body;
			const query = { user_email: req.decoded.email };
			// const query = { email: "pazi@pazi.com"}
			const user = await userCollection.findOne(query);
			if (!user?.cartId) {
				await cartCollection
					.insertOne({
						cartItems: [{ productId: newItem._id, quantity: 1 }],
						user_email: req.decoded.email,
					})
					.then(async (result) => {
						await userCollection.updateOne(query, {
							$set: { cartId: result.insertedId },
						});
						res.status(201).send({ success: true, ...result });
					});
			}
			if (user?.cartId) {
				const queryUserCart = {
					_id: new ObjectId(user.cartId),
				};

				// check same item
				await cartCollection.findOne(queryUserCart).then(async (cart) => {
					let isSameProduct = false;
					cart.cartItems.forEach(async (item) => {
						if (item.productId === newItem._id) {
							isSameProduct = true;
							item.quantity += 1;
							const result = await cartCollection.updateOne(queryUserCart, {
								$set: { cartItems: cart.cartItems },
							});
							res.send(result);
						}
					});
					if (!isSameProduct) {
						const result = await cartCollection.updateOne(queryUserCart, {
							$push: { cartItems: { productId: newItem._id, quantity: 1 } },
						});
						res.send(result);
					}
				});
			}
		});

		// increment or decrement quantity
		app.post(
			"/carts/change-quantity/:cartId/:type",
			verifyToken,
			async (req, res) => {
				const _id = req.params.cartId;
				const newItem = req.body;
				const cart = await cartCollection.findOne({ _id: new ObjectId(_id) });
				if (cart.user_email !== req.decoded.email) {
					res.status(403).send({ message: "Forbidden access" });
				}
				cart.cartItems.forEach(async (item) => {
					if (item.productId === newItem._id) {
						if (req.params.type === "increment") {
							item.quantity += 1;
						} else {
							if (item.quantity > 1) {
								item.quantity -= 1;
							} else {
								const result = await cartCollection.updateOne(
									{
										_id: new ObjectId(_id),
									},
									{
										$pull: { cartItems: { productId: newItem._id } },
									}
								);
								res.send(result);
								return;
							}
						}
						const result = await cartCollection.updateOne(
							{ _id: new ObjectId(_id) },
							{
								$set: { cartItems: cart.cartItems },
							}
						);
						res.send(result);
					}
				});
			}
		);

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
