const express = require("express");
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

app.use(cors())
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



admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});





const verifyFireBaseToken = async(req, res, next)=>{
  const authHeaders = req.headers?.authorization;
  if(!authHeaders || !authHeaders.startsWith("Bearer ")){
    return res.status(401).send({message: 'unauthorized access'})
  }
  const token = authHeaders.split(" ")[ 1 ];
  try{
    const decoded = await admin.auth().verifyIdToken(token)
    req.decoded = decoded;
    next();
  }catch(error){
    return res.status(401).send({message: "unauthorized access", error: error})
  }
}



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("prodDivine");
    const queryCollection = db.collection("query");
    const recommendCollection = db.collection("recommendation");
    const bookmarksCollection = db.collection("bookmarks")

    //Get Recent query
    app.get("/recent-query", async (req, res) => {
      const result = await queryCollection
        .find()
        .sort({ timestamp: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    //Get all query
    app.get("/queries", async (req, res) => {
      const { search, sort } = req.query;
      let query = {};
      let sortQuery = {};

      // Search filter
      if (search && search.trim() !== "") {
        query = {
          productName: { $regex: search, $options: "i" },
        };
      }

      // Sorting
       if (sort === "asc") {
         sortQuery = { recommendationCount: 1 };
       } else if (sort === "desc") {
         sortQuery = { recommendationCount: -1 };
       } else {
         // Default sort
         sortQuery = { timestamp: -1 };
       }

      const result = await queryCollection
        .find(query)
        .sort(sortQuery)
        .toArray();
      res.send(result);
    });

    // get a specific query details
    app.get("/query-details/:id", async(req, res)=>{
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await queryCollection.findOne(filter);
      res.send(result);
    })

    app.post("/add-query", verifyFireBaseToken, async (req, res) => {
      const updatedQuery = req.body;
      const queryupdatedQuery = { ...updatedQuery, timestamp: new Date() };
      const result = await queryCollection.insertOne(queryupdatedQuery);
      res.send(result);
    });

    //Get my query by email
    app.get("/my-queries", verifyFireBaseToken, async (req, res) => {
      const { email } = req.query;
      const query = { email: email };
      const result = await queryCollection
        .find(query)
        .sort({ timestamp: -1 })
        .toArray();
      res.send(result);
    });

    // Update a query
    app.patch("/update-query/:id", verifyFireBaseToken, async (req, res) => {
      const { id } = req.params;
      const updatedQuery = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: updatedQuery,
      };
      const result = await queryCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Delete a query
    app.delete("/delete-query/:id", verifyFireBaseToken, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await queryCollection.deleteOne(query);
      res.send(result);
    });


    // Bookmark a query
    app.put("/bookmark", async (req, res) => {
      const { userEmail, booked } = req.body;
      if (!userEmail || !Array.isArray(booked) || booked.length === 0) {
        return res
          .status(400)
          .json({ error: "Missing userEmail or booked id" });
      }
      try {
        const filter = { userEmail };
        const exist = await bookmarksCollection.findOne(filter);
        if (exist.booked.includes(booked[0])) {
          res.send({
            acknowledged: true,
            matchedCount: 1,
            modifiedCount: 0,
            upsertedCount: 0,
            upsertedId: null,
          });
          return
        }
        if(exist){
          const result = await bookmarksCollection.updateOne(filter, { $push: { booked: booked[0] } })
          res.send(result)
          return
        }
        const result = await bookmarksCollection.insertOne({ userEmail, booked })
        res.send(result);
      } catch (error) {
        console.error("Error updating bookmark:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });


    // Get bookmarked queries
    app.get("/bookmarked-items/:email", async (req, res) => {
      const { email } = req.params;
      const filter = { userEmail: email };
      const { booked } = await bookmarksCollection.findOne(filter);
      // Convert strings to ObjectId
      const ids = booked.map((idStr) => new ObjectId(idStr));
      const query = { _id: { $in: ids } };
      const result = await queryCollection.find(query).toArray();
      res.send(result);
    });




    // recommendation related api

    app.get('/all-recommendations/:id', async(req, res)=>{
      const { id } = req.params;
      const query = { queryId: id };
      const result = await recommendCollection.find(query).toArray();
      res.send(result)
    })



    app.post("/add-recommendation", verifyFireBaseToken, async (req, res) => {
      const data = req.body;
      const recommendedData = {
        ...data,
        timestamp: new Date(),
      };
      const result = await recommendCollection.insertOne(recommendedData);
      if (result.insertedId) {
        const filter = { _id: new ObjectId(data.queryId) };
        const updateRecommendationCount = await queryCollection.updateOne(
          filter,
          {
            $inc: {
              recommendationCount: 1,
            },
          }
        );
        res.send({ result, updateRecommendationCount });
      }
    });


    // Add comment in recommendation
    app.patch("/recommendations/comment/:id", async(req, res)=>{
      const { id } = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $push: {
          comments: data
        }
      };
      const result = await recommendCollection.updateOne(filter, updatedDoc, {upsert: true});
      res.send(result);
    });


    // My Recommendations
    app.get("/my-recommendations/:email",verifyFireBaseToken, async(req, res)=>{
      const { email } = req.params;
      const query = {recommenderEmail: email}
      const result = await recommendCollection.find(query).toArray();
      res.send(result)
    });


    //Delete my recommendation
    app.delete("/delete-recommendations",verifyFireBaseToken, async(req, res)=>{
      const { productId, queryId } = req.query;
      const query = {_id: new ObjectId(productId)};
      const result = await recommendCollection.deleteOne(query);
      if(result.deletedCount === 1){
        const filter = { _id: new ObjectId(queryId) }
        const updatedRecommendation = await queryCollection.updateOne(filter, {
          $inc: {
            recommendationCount: -1,
          },
        });
        res.send({result, updatedRecommendation})
      }
    });


    //get all Recommendations for log in user
    app.get("/recommendations-for-me",verifyFireBaseToken, async(req, res)=>{
      const {email} = req.query;
      const query = { userEmail: email };
      const result = await recommendCollection.find(query).toArray();
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.listen(port, ()=>{
  console.log(`Server running on: http://localhost:${port}`)
})