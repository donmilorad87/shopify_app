import { json } from "@remix-run/node";

import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import crypto from "crypto";
export async function loader({ request }: LoaderFunctionArgs) {
  //get data from db

  console.log(request.url);
 /*  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);


 
  const hmac = params.get("hmac"); 
  const host = params.get("host"); 
  const shop = params.get("shop"); 
  const timestamp = params.get("timestamp"); 


 */
// Assuming the request URL is available
const requestUrl = request.url;
const apiKey = process.env.SHOPIFY_API_KEY ?? "";
const sharedSecret = process.env.SHOPIFY_API_SECRET ?? "";
const urlObj = new URL(requestUrl);
const params = new URLSearchParams(urlObj.search);
;

// Retrieve HMAC request parameter
const hmac = params.get('hmac') ?? "";
const shop = params.get("shop"); 
const code = params.get("code"); 
// Remove hmac from params
params.delete('hmac');

// Sort params lexicographically
const sortedParams = [...params].sort((a, b) => a[0].localeCompare(b[0]));


// Compute SHA256 digest
const message = sortedParams.map(pair => pair.join('=')).join('&'); 

 const computedHmac = crypto.createHmac('sha256', sharedSecret).update(message).digest('hex');

// Use hmac data to check that the response is from Shopify or not
if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(computedHmac))) {
  console.log('VALIDATED');

  const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
  const query = {
    client_id: apiKey,
    client_secret: sharedSecret,
    code: code ?? ""
  };
  console.log(accessTokenUrl);
  
  getAccessToken(accessTokenUrl, query);
// Function to get the access token
async function getAccessToken(accessTokenUrl:string, query:{
  client_id: string;
  client_secret: string;
  code: string;}) {
  try {
    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(query).toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const accessToken = result.access_token;

    console.log('Access Token:', accessToken);


   
const storeUrl = shop // Replace with your store URL
const themeId = 161026277680; // Replace with your theme ID
const apiVersion = '2024-07';

const url2 = `https://${storeUrl}/admin/api/${apiVersion}/themes/${themeId}/assets.json`;
console.log(url2);

const data = {
  asset: {
    key: 'assets/sw.js',
    value: `console.log('zzz');`
  }
};
updateAsset(url2, data);
async function updateAsset(url:string, data:any) {
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then((response) => {
      console.log(response);
      
    }).then((data) => {
      console.log('Asset updated successfully:', data);
    });

   /*  const result = await response.json();
    console.log('Asset updated successfully:', result); */
  } catch (error) {
    console.error('Error updating asset:', error);
  }
}



  } catch (error) {
    console.error('Error:', error);
  }
}

// Call the function to get the access token


} else {
  console.log('NOT VALIDATED – Someone is trying to be shady!');
} 

  return json({
    message: "callback",
    success: true,
  });
}
