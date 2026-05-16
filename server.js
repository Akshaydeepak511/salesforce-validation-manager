require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jsforce = require('jsforce');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

const oauth2 = new jsforce.OAuth2({
  loginUrl: process.env.LOGIN_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
});

app.get('/', (req, res) => {
  res.send('Backend Running');
});

app.get('/auth/salesforce', (req, res) => {
  res.redirect(oauth2.getAuthorizationUrl());
});

app.get('/auth/salesforce/callback', async (req, res) => {

  const conn = new jsforce.Connection({ oauth2 });

  const code = req.query.code;

  await conn.authorize(code);

  global.accessToken = conn.accessToken;
  global.instanceUrl = conn.instanceUrl;

  res.redirect('http://localhost:3000');
});

app.get('/validation-rules', async (req, res) => {

  const conn = new jsforce.Connection({
    instanceUrl: global.instanceUrl,
    accessToken: global.accessToken
  });

  try {

    const result = await conn.tooling.query(
      "SELECT Id, ValidationName, Active FROM ValidationRule"
    );

    res.json(result.records);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: error.message,
      data: error.data
    });
  }
});

app.post('/toggle-validation-rule/:id', async (req, res) => {

  const conn = new jsforce.Connection({
    instanceUrl: global.instanceUrl,
    accessToken: global.accessToken
  });

  const ruleId = req.params.id;

  const { active } = req.body;

  try {

    await conn.tooling.sobject('ValidationRule').update({
      Id: ruleId,
      Metadata: {
        active: active
      }
    });

    res.json({
      success: true,
      message: 'Validation Rule Updated'
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});