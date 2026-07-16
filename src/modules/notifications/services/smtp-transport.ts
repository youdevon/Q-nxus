import nodemailer, {
  type Transporter,
} from "nodemailer"

import {
  getSmtpConfiguration,
  validateSmtpConfiguration,
} from "./smtp-config"

let cachedTransport: Transporter | null = null
let cachedSignature = ""

function configurationSignature(): string {
  const configuration = getSmtpConfiguration()

  return JSON.stringify({
    enabled: configuration.enabled,
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    username: configuration.username,
    fromEmail: configuration.fromEmail,
  })
}

export function getSmtpTransport(): Transporter {
  const configuration = getSmtpConfiguration()

  const errors =
    validateSmtpConfiguration(configuration)

  if (errors.length > 0) {
    throw new Error(errors.join(" "))
  }

  const signature = configurationSignature()

  if (
    cachedTransport !== null &&
    signature === cachedSignature
  ) {
    return cachedTransport
  }

  const transport = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    pool: true,
    maxConnections: configuration.maxConnections,
    connectionTimeout:
      configuration.connectionTimeoutMs,
    auth: {
      user: configuration.username,
      pass: configuration.password,
    },
  })

  cachedTransport = transport
  cachedSignature = signature

  return transport
}

export async function verifySmtpConnection(): Promise<void> {
  const transport = getSmtpTransport()

  await transport.verify()
}
