import 'dotenv/config'
console.log(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || '{}').client_email)
