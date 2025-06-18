const express = require("express");
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

app.get("/", (req,res)=>{
  res.send("Server Running");
})



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.rsivwxo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const db = client.db("prodDivine");
    const queryCollection = db.collection("query");

    app.post("/add-query", async(req, res)=>{
      const updatedQuery = req.body;
      const queryupdatedQuery = { ...updatedQuery, timestamp: new Date() };
      const result = await queryCollection.insertOne(queryupdatedQuery);
      res.send(result);
    })


    //Get my query by email
    app.get("/my-queries", async(req, res)=>{
      const { email } = req.query;
      const query = { email: email };
      const result = await queryCollection
        .find(query)
        .sort({ timestamp: -1 })
        .toArray();
      res.send(result);
    });


    // Update a query
    app.patch("/update-query/:id", async(req, res)=>{
      const {id} = req.params;
      const updatedQuery = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: updatedQuery
      }
      const result = await queryCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    // Delete a query
    app.delete("/delete-query/:id", async(req, res)=>{
      const {id} = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await queryCollection.deleteOne(query);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.listen(port, ()=>{
  console.log(`Server running on: http://localhost:${port}`)
})