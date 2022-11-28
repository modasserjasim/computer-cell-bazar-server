const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
require('colors');


const app = express();
const port = process.env.PORT || 4000;

//Middle wares
app.use(cors());
app.use(express.json());

// configure MongoDB

const uri = process.env.DB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const usersCollection = client.db('computerBazar').collection('users');
const categoriesCollection = client.db('computerBazar').collection('productCategories');
const productsCollection = client.db('computerBazar').collection('products');
const bookingsCollection = client.db('computerBazar').collection('bookings');

// Verify JWT
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    // console.log({ authHeader });
    if (!authHeader) {
        return res.status(401).send('Unauthorized access');
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        console.log('Database Connected'.yellow);
    } catch (error) {
        console.log(error.name.bgRed, error.message.bold, error.stack);
    }
}
run();

//JWT
app.get('/jwt', async (req, res) => {
    const email = req.query.email;

    const user = await usersCollection.findOne({ email: email });
    if (user) {
        var token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '10d' });
        return res.send({ accessToken: token });
    }
    // console.log(user);
    res.status(403).send({ accessToken: '' });
})

// save users to db
app.post('/user', async (req, res) => {
    try {
        console.log(req.body);
        const user = await usersCollection.insertOne(req.body);
        console.log(user);
        res.send({
            status: true,
            message: `The user successfully added`
        })
    } catch (error) {
        console.log(error.name, error.message);
        res.send({
            status: false,
            error: error
        })
    }
});

// Save user email when user login with Google email
app.put('/user/:email', async (req, res) => {
    const email = req.params.email
    const user = req.body
    const filter = { email: email }
    const options = { upsert: true }
    const updateDoc = {
        $set: user,
    }
    const result = await usersCollection.updateOne(filter, updateDoc, options)
    console.log(result)
    res.send(result)
})

//get categories from db
app.get('/product-categories', async (req, res) => {
    try {
        const query = {}
        const productCategories = await categoriesCollection.find(query).toArray();
        res.send({
            status: true,
            productCategories
        })
    } catch (error) {
        res.send({
            status: false,
            error: error
        })
    }
})

//Insert the product using post method
app.post('/add-product', verifyJWT, async (req, res) => {
    try {
        const product = await productsCollection.insertOne(req.body);
        console.log(product);
        res.send({
            status: true,
            message: `You have successfully added ${req.body.title}!`
        })
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })
    }

})

// get the products using category
app.get('/category/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // const query = { category_id: id }
        const query = {
            $and: [
                {
                    category_id: id
                },
                {
                    $or: [
                        { isSold: false },
                        { isSold: { $exists: false } }
                    ]
                }
            ]
        }
        const categoryProducts = await productsCollection.find(query).toArray();
        res.send({
            status: true,
            categoryProducts
        })
    } catch (error) {
        res.send({
            status: false,
            error: error
        })
    }
})

app.post('/booking', async (req, res) => {
    try {
        const booking = await bookingsCollection.insertOne(req.body);
        res.send({
            status: true,
            message: `You have successfully booked ${req.body.productName}!`
        })
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })
    }
})

//get the advertised products and make sure the product is available
app.get('/advertised-products', async (req, res) => {
    try {
        const query = {
            $and: [
                {
                    isAdvertised: true
                },
                {
                    $or: [
                        { isSold: false },
                        { isSold: { $exists: false } }
                    ]
                }
            ]
        };
        const adsProducts = await productsCollection.find(query).toArray();
        res.send({
            status: true,
            adsProducts
        })
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })
    }
})

//get the products for specific seller
app.get('/my-products', verifyJWT, async (req, res) => {
    try {
        const products = await productsCollection.find({ sellerEmail: req.query.email }).toArray();
        res.send({
            status: true,
            products
        })
    } catch (error) {
        console.log(error.name, error.message);
        res.send({
            status: false,
            error: error.message
        })
    }

})

//update the product sales status from the my products //should be verifySeller
app.patch('/my-product/:id', verifyJWT, async (req, res) => {
    try {
        const id = req.params.id;
        const status = req.body.status;
        // console.log('inside', id, status);
        const query = { _id: ObjectId(id) };
        const updatedDoc = {
            $set: {
                isSold: status
            }
        }
        const result = await productsCollection.updateOne(query, updatedDoc);
        console.log(result);

        res.send({
            status: true,
            message: `The product is marked as ${status ? 'Sold' : 'Available'}`
        });
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })
    }
})
//make the product advertised/featured //should be verifySeller
app.patch('/my-product/ad/:id', verifyJWT, async (req, res) => {
    try {
        const id = req.params.id;
        const status = req.body.status;
        // console.log('inside ad', id, status);
        const query = { _id: ObjectId(id) };
        const updatedDoc = {
            $set: {
                isAdvertised: status
            }
        }
        const result = await productsCollection.updateOne(query, updatedDoc);

        res.send({
            status: true,
            message: `You have successfully boosted this product!}`
        });
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })
    }
})

// delete the product from my-products route
app.delete('/my-product/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await productsCollection.deleteOne(query);
    res.send({
        status: true,
        message: 'The product has been deleted'
    });
})

//get all the sellers
app.get('/all-sellers', async (req, res) => {
    try {
        const query = { role: 'seller' };
        const allSellers = await usersCollection.find(query).toArray();
        res.send({
            status: true,
            allSellers
        })
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })

    }

})

//make the seller verified //should be verifyAdmin
app.patch('/seller/:id', verifyJWT, async (req, res) => {
    try {
        const id = req.params.id;
        const status = req.body.status;
        console.log('inside', id, status);
        const query = { _id: ObjectId(id) };
        const updatedDoc = {
            $set: {
                isSellerVerified: status
            }
        }
        const result = await usersCollection.updateOne(query, updatedDoc);
        // const productResult = await productsCollection.updateOne(query, updatedDoc)


        res.send({
            status: true,
            message: `You have successfully verified the seller!`
        });
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })
    }
})

// delete the seller from all-seller route //verifyAdmin
app.delete('/seller/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await usersCollection.deleteOne(query);
    res.send({
        status: true,
        message: 'The Seller has been deleted!'
    });
})

//get all the buyers
app.get('/all-buyers', async (req, res) => {
    try {
        const query = { role: 'buyer' };
        const allBuyers = await usersCollection.find(query).toArray();
        res.send({
            status: true,
            allBuyers
        })
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })

    }

})

// delete the buyers from all-buyers route //verifyAdmin
app.delete('/buyer/:id', verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) };
    const result = await usersCollection.deleteOne(query);
    res.send({
        status: true,
        message: 'The Buyer has been deleted!'
    });
})

//make the product reported //should be verifyBuyer
app.patch('/reported-product/:id', verifyJWT, async (req, res) => {
    try {
        const id = req.params.id;
        const status = req.body.status;
        const query = { _id: ObjectId(id) };
        const updatedDoc = {
            $set: {
                isReported: status
            }
        }
        const result = await productsCollection.updateOne(query, updatedDoc);

        res.send({
            status: true,
            message: `You have successfully reported this product. We'll verify the product soon!`
        });
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })
    }
})

//get the reported products
app.get('/reported-products', verifyJWT, async (req, res) => {
    try {
        const reportedProducts = await productsCollection.find({ isReported: true }).toArray();
        res.send({
            status: true,
            reportedProducts
        })
    } catch (error) {
        res.send({
            status: false,
            error: error.message
        })
    }

})

// find if admin or not
app.get('/user/admin/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email };
    const user = await usersCollection.findOne(query);
    res.send({ isAdmin: user?.role === 'admin' });
})

app.get('/', (req, res) => {
    res.send("Computer Bazar Server is Running");
})

app.listen(port, () => {
    console.log(`Computer Bazar is running on port ${port}`.cyan.bold);
})