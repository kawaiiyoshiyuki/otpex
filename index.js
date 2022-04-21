const express = require("express");
const bodyParser = require('body-parser');
const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;
const uuid = require("uuid");
const speakeasy = require("@levminer/speakeasy");

const app = express();

// The second argument is used to tell the DB to save after each push
// If you put false, you'll have to call the save() method.
// The third argument is to ask JsonDB to save the database in an human readable format. (default false)
// The last argument is the separator. By default it's slash (/)
const db = new JsonDB(new Config("myDataBase", true, false, '/'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/api", (req,res) => {
  res.json({ message: "Welcome to the two factor authentication example" })
});


app.post("/api/register", async (req, res) => {
  const id = uuid.v4();
  try {
    const path = `/user/${id}`;
    // Create temporary secret until it it verified
    const temp_secret = speakeasy.generateSecret(
      { name: 'secret', length: 160, issuer: 'Yosiro' }
    );
    // Create user in the database
    db.push(path, { id, temp_secret });
    const qrcode = require('qrcode');
    const code = await qrcode.toDataURL(temp_secret.otpauth_url);
    // Send user id and base32 key to user
    res.json({ id, code })
    // res.send('<img src="' + code + '">');
  } catch(e) {
    console.log(e);
    res.status(500).json({ message: 'Error generating secret key'})
  }
})

app.post("/api/verify", (req,res) => {
  const { userId, token } = req.body;
  try {
    // Retrieve user from database
    const path = `/user/${userId}`;
    const user = db.getData(path);
    console.log({ user })
    const { base32: secret } = user.temp_secret;
    if (!secret) res.status(400).json({ message: 'Already verified'});
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token
    });
    if (verified) {
      // Update user data
      db.push(path, { id: userId, secret: user.temp_secret });
      res.json({ verified: true })
    } else {
      res.json({ verified: false})
    }
  } catch(error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving user'})
  }
})

app.post("/api/validate", (req,res) => {
  const { userId, token } = req.body;
  try {
    // Retrieve user from database
    const path = `/user/${userId}`;
    const user = db.getData(path);
    console.log({ user })
    const { base32: secret } = user.secret;
    // Returns true if the token matches
    const tokenValidates = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });
    if (tokenValidates) {
      res.json({ validated: true })
    } else {
      res.json({ validated: false})
    }
  } catch(error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving user'})
  }
})

const port = 5003;

app.listen(port, () => {
  console.log(`App is running on PORT: ${port}.`);
});