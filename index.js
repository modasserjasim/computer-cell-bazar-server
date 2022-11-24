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

app.get('/', (req, res) => {
    res.send("Computer Bazar Server is Running");
})

app.listen(port, () => {
    console.log(`Computer Bazar is running on port ${port}`.cyan.bold);
})