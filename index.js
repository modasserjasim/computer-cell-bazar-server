const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
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
app.post('/product', verifyJWT, async (req, res) => {
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
        const query = { category_id: id }
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

//get the booking info from db
app.get('/bookings', verifyJWT, async (req, res) => {
    try {
        // console.log(req.headers.authorization);
        const email = req.query.email;
        const decodedEmail = req.decoded.email;
        // console.log('inside booking', email, decodedEmail);
        if (email !== decodedEmail) {
            return res.status(403).send({ message: 'Forbidden access' })
        }

        //before JWT
        const bookings = await bookingsCollection.find({ email: req.query.email }).toArray();
        res.send({
            status: true,
            bookings: bookings
        })
    } catch (error) {
        console.log(error.name, error.message);
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