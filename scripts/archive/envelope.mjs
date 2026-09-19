/** Encrypt private corpus bytes before a public-repository artifact upload. */
import { createCipheriv, publicEncrypt, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const [input, publicKeyFile, output] = process.argv.slice(2);
if (!input || !publicKeyFile || !output) throw new Error('Usage: envelope.mjs input.zip recipient.pub.pem output.gxa');
const data = readFileSync(input);
if (data.length > 650 * 1024 * 1024) throw new Error('Archive too large');
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(Buffer.from('gaokao-xinsheng/archive-envelope/1'));
const body = Buffer.concat([cipher.update(data), cipher.final()]);
const wrapped = publicEncrypt({key: readFileSync(publicKeyFile), oaepHash:'sha256'}, key);
const header = Buffer.from(JSON.stringify({schema:'archive-envelope/1', alg:'AES-256-GCM', wrap:'RSA-OAEP-SHA256', iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64'), wrappedKey:wrapped.toString('base64')}));
const length = Buffer.alloc(4); length.writeUInt32BE(header.length);
writeFileSync(output, Buffer.concat([Buffer.from('GXA1'), length, header, body]), {mode:0o600});
key.fill(0);
console.log('Encrypted archive written; plaintext is not an uploaded artifact.');
