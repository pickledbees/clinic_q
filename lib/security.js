const _ = require("lodash");
const nonce = require("nonce")();
const crypto = require("crypto");
const qs = require("querystring");
const jwt = require("jsonwebtoken");
const jose = require("node-jose");

/**
 * Verifies and decodes a JWS into the json object
 * @param jws
 * @param publicCert
 * @returns {*} verified and decoded json object
 */
function verifyJWS(jws, publicCert) {
  // ignore not before check because it gives errors sometimes if the call is too fast.
  try {
    return jwt.verify(jws, publicCert, {
      algorithms: ["RS256"],
      ignoreNotBefore: true,
    });
  } catch (e) {
    console.error("Error with verifying and decoding JWS: %s", e);
    throw new Error("Error with verifying and decoding JWS");
  }
}

/**
 * Encrypts data string
 * @param publicCert
 * @param data string
 * @returns {Promise<Buffer|void|string>}
 */
async function encryptDataIntoCompactJWE(publicCert, data) {
  const keystore = jose.JWK.createKeyStore();

  try {
    const jweKey = await keystore.add(publicCert, "pem");
    return jose.JWE.createEncrypt(
      {
        format: "compact",
        fields: {
          alg: "RSA-OAEP",
          enc: "A256GCM",
        },
      },
      jweKey
    )
      .update(Buffer.from(data))
      .final();
  } catch (e) {
    console.log(e);
    throw new Error("failed to encrypt data");
  }
}

/**
 * Decrypts JWE into JWS
 * @param compactJWE
 * @param privateKey
 * @returns {Promise<any>} decrypted JWE into JWS
 */
async function decryptJWE(compactJWE, privateKey) {
  //compact JWE format is header.encryptedKey.iv.cipherText.tag (5 parts)
  const jweParts = compactJWE.split(".");
  if (jweParts.length !== 5) {
    console.error(
      "JWE format incorrect: expected 5 parts got %s",
      jweParts.length
    );
    throw new Error("JWE format incorrect");
  }
  const data = {
    type: "compact",
    protected: jweParts[0],
    encrypted_key: jweParts[1],
    iv: jweParts[2],
    ciphertext: jweParts[3],
    tag: jweParts[4],
    header: JSON.parse(jose.util.base64url.decode(jweParts[0]).toString()),
  };

  try {
    const keystore = jose.JWK.createKeyStore();
    const jweKey = await keystore.add(privateKey, "pem");

    const decrypted = await jose.JWE.createDecrypt(jweKey).decrypt(data);
    return JSON.parse(decrypted.payload.toString());
  } catch (e) {
    console.error("could not decrypt jwe: %s", e);
    throw new Error("could not decrypt jwe");
  }
}

/**
 * @param url Full API URL
 * @param params JSON object of params sent, key/value pair.
 * @param method
 * @param appId ClientId
 * @param privateKey Private Key Certificate content
 * @param privateKeyPassphrase Private Key Certificate Passphrase
 * @returns {string}
 */
function generateSHA256withRSAHeader(
  url,
  params,
  method,
  appId,
  privateKey,
  privateKeyPassphrase
) {
  const nonceValue = nonce();
  const timestamp = new Date().getTime();

  //construct the authorisation token
  let defaultApexHeaders = {
    app_id: appId, // App ID assigned to application
    nonce: nonceValue, // secure random number
    signature_method: "RS256",
    timestamp: timestamp, // Unix epoch time
  };

  //forming the Signature Base String

  //normalisation of params
  const baseParams = sortJSON(_.merge(defaultApexHeaders, params));
  let baseParamsStr = qs.stringify(baseParams);
  baseParamsStr = qs.unescape(baseParamsStr);

  const baseString = method.toUpperCase() + "&" + url + "&" + baseParamsStr;

  //creation of signature from baseString

  //options setup
  const signWith = {
    key: privateKey,
  };

  //only include passphrase in signature creation if provided
  if (!_.isUndefined(privateKeyPassphrase) && !_.isEmpty(privateKeyPassphrase))
    _.set(signWith, "passphrase", privateKeyPassphrase);

  //sign baseString to form signature
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(baseString)
    .sign(signWith, "base64");

  //return header
  return (
    'PKI_SIGN timestamp="' +
    timestamp +
    '",nonce="' +
    nonceValue +
    '",app_id="' +
    appId +
    '",signature_method="RS256"' +
    ',signature="' +
    signature +
    '"'
  );
}

/**
 * Sorts a json's keys alphabetically
 * @param json
 * @returns {{}|*}
 */
function sortJSON(json) {
  if (_.isNil(json)) {
    return json;
  }

  const newJSON = {};
  const keys = Object.keys(json);
  keys.sort();

  for (let key of keys) {
    newJSON[key] = json[key];
  }

  return newJSON;
}

module.exports = {
  generateSHA256withRSAHeader,
  verifyJWS,
  encryptDataIntoCompactJWE,
  decryptJWE,
};
