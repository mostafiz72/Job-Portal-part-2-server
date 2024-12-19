require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors({
    origin: ['http://localhost:5173'], /// ai api theke data asbe
    credentials: true  // j kono jaiga theke data asle amra take access ditesi
}));
app.use(express.json());
app.use(cookieParser());  /// atar jonno amara sob jaiga theke cookie access korete pertesi

/// Create thek middleware and access the anything api this middleware ------------------------

const verifyToken = (req, res, next)=>{
    const token = req.cookies?.token;
    console.log("Tumi tomar api theke ai token ta access korte perteso", token)

    // token jodi na thake taile amra tare ekta error message dibo

    if(!token){
        return res.status(401).send({message: 'No token, authorization denied'});
    }

    // jodi token thake taile amra tare validations korbo -------------------
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
        if(err){
            return res.status(401).send({message: 'Token is not valid'});
        }
    })
    next();
    
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.eywn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // jobs related apis
        const jobsCollection = client.db('jobPortal').collection('jobs');
        const jobApplicationCollection = client.db('jobPortal').collection('job_applications');

        /// Jwt and Authorization and Api Authentication 

        app.post('/jwt', (req, res)=>{  /// ai post jwt api k authProvider er mordhe theke calll kora hoyse
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '5h' })  //// jwt.sign mane tader function er mardhome jwt create kora hoy... user-------> mane j sing up korbe se hobe ekjob user. R jodi keu admin hoy taile oi khane amara admin or etc bosaiya dibo. tarpor expireIn mane use er token kotokkhon thakbe
            res.cookie("token", token,{
                httpOnly: true,
                secure: false
            })
            .send({success: true})   /// token ta jodi thik moto crate hoy taile amra font end a success ta dekhabo
        })

        /// logOut the user and clear the Cookies --------------

        app.post('/logout', (req, res)=>{
            res.clearCookie("token", {
                httpOnly: true,
                secure: false
            })
            .send({success: true})   /// jodi logout thik moto hoy taile success message dibe ----------------------------------
        })

        // jobs related APIs
        app.get('/jobs', async (req, res) => {
            const email = req.query.email;
            let query = {};
            if (email) {
                query = { hr_email: email }
            }
            const cursor = jobsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(query);
            res.send(result);
        });

        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            const result = await jobsCollection.insertOne(newJob);
            res.send(result);
        })


        // job application apis
        // get all data, get one data, get some data [o, 1, many]
        app.get('/job-application',verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { applicant_email: email }

            // console.log(req.cookies.token);
            
            const result = await jobApplicationCollection.find(query).toArray();

            // fokira way to aggregate data
            for (const application of result) {
                // console.log(application.job_id)
                const query1 = { _id: new ObjectId(application.job_id) }
                const job = await jobsCollection.findOne(query1);
                if (job) {
                    application.title = job.title;
                    application.location = job.location;
                    application.company = job.company;
                    application.company_logo = job.company_logo;
                }
            }

            res.send(result);
        })

        // app.get('/job-applications/:id') ==> get a specific job application by id

        app.get('/job-applications/jobs/:job_id', async (req, res) => {
            const jobId = req.params.job_id;
            const query = { job_id: jobId }
            const result = await jobApplicationCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/job-applications', async (req, res) => {
            const application = req.body;
            const result = await jobApplicationCollection.insertOne(application);

            // Not the best way (use aggregate) 
            // skip --> it
            const id = application.job_id;
            const query = { _id: new ObjectId(id) }
            const job = await jobsCollection.findOne(query);
            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1;
            }
            else {
                newCount = 1;
            }

            // now update the job info
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    applicationCount: newCount
                }
            }

            const updateResult = await jobsCollection.updateOne(filter, updatedDoc);

            res.send(result);
        });


        app.patch('/job-applications/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await jobApplicationCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Job is falling from the sky')
})

app.listen(port, () => {
    console.log(`Job is waiting at: ${port}`)
})