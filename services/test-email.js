import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 587,
  secure: false,
  auth: {
    user: 'resend',
    pass: 'SUA_API_KEY_RESEND'
  }
})

await transporter.sendMail({
  from: 'PHMSDEV <no-reply@send.phmsdev.com.br>',
  to: 'SEU_EMAIL_REAL@gmail.com',
  subject: 'Teste SMTP Resend',
  text: 'Se chegou, o SMTP está OK.'
})

console.log('Email enviado')
