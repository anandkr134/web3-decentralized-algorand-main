import algosdk from 'algosdk';

const algodToken = process.env.NEXT_PUBLIC_ALGOD_TOKEN || '';
const algodServer = process.env.NEXT_PUBLIC_ALGOD_SERVER || 'https://testnet-api.algonode.cloud';
const algodPort = process.env.NEXT_PUBLIC_ALGOD_PORT || '';

export const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

