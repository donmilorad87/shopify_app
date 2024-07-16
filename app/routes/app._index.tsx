import {
  Box,
  Card,
  Page,
  Text,
  BlockStack,
  InlineGrid,
  TextField,
  Checkbox,
  Button,
  Toast,
} from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { useEffect, useState } from "react";
//import prisma db
import db from "../db.server";

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import fs from 'fs';
import path from 'path';
import toml from 'toml';

export function readShopifyAppToml() {
  const filePath = path.resolve('shopify.app.toml');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const config = toml.parse(fileContent);
  return config;
}
type settingsObject = {
  id?: string;
  tag: string;
  active: boolean;
  message?: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  //get data from db
  const { admin, session } = await authenticate.admin(request);

  let shopInfo = await admin.rest.resources.Shop.all({
    session: session,
  });

  console.log(session, admin,'88890');
  
  const response = await admin.graphql(
    `#graphql
    query {
      app {
          installation {
            id
            launchUrl
          }
          id
          title
          apiKey
          appStoreAppUrl
          appStoreDeveloperUrl
          description
          developerName
        }
      
    }`,
  );

  const data = await response.json();
  const config = readShopifyAppToml();
  const appUrl = config.application_url;
  console.log(appUrl, '_____________2_________');
  
  let scopes =
    "read_content,read_files,read_products,read_script_tags,read_themes,write_content,write_files,write_products,write_script_tags,write_themes";
  let url = `https://${shopInfo.data[0].myshopify_domain}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${appUrl}/api/auth/callback`;
  console.log(url, '_____________3_________');
/*   await fetch(url, {
    "credentials": "include",
    "method": "GET",
    "mode": "cors"
}).then((response) => {
  response.json();
  console.log(response, '_____________4_________');
}).then((data) => {
  console.log(data, '_____________5_________');
}); */
  let shopId: string;
  let ocambaHoodSettings: settingsObject | null;

  if (shopInfo.data[0].id) {
    shopId = shopInfo.data[0].id.toString();
    ocambaHoodSettings = await db.settings?.findFirst({
      where: {
        id: shopId,
      },
    });

    if (!ocambaHoodSettings) {
      ocambaHoodSettings = {
        id: shopId,
        tag: "",
        active: true,
      };

      await db.settings.create({
        data: {
          id: shopId,
          tag: "",
          active: true,
        },
      });
    }

    return json(ocambaHoodSettings);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  let ocambaHoodSettingsPayload: any = await request.formData();
  let ocambaHoodSettings = Object.fromEntries(ocambaHoodSettingsPayload);

  /* if (ocambaHoodSettings.tag === "") {
    return json({
      message: "Tag can not be empty",
    });
  }

  if (
    ocambaHoodSettings.tag.length < 32 ||
    ocambaHoodSettings.tag.length > 44
  ) {
    return json({
      message: "Tag must be between 32 and 44 characters",
    });
  }

  let url = `https://cdn.ocmtag.com/tag/${ocambaHoodSettings.tag}.json`;
  let validateTagId = await fetchData(url);

  if (!validateTagId) {
    return json({
      message: "Tag is not valid",
    });
  }

  const { admin, session } = await authenticate.admin(request);
  let shopInfo = await admin.rest.resources.Shop.all({
    session: session,
  });

  let shopId: string;
  if (shopInfo.data[0].id) {
    console.log(shopInfo);

    shopId = shopInfo.data[0].id.toString();

    await db.settings
      .upsert({
        where: {
          id: shopId,
        },

        update: {
          id: shopId,
          tag: ocambaHoodSettings.tag,
          active: ocambaHoodSettings.active === "true" ? true : false,
        },
        create: {
          id: shopId,
          tag: ocambaHoodSettings.tag,
          active: ocambaHoodSettings.active === "true" ? true : false,
        },
      })
      .then(async () => {
        let message = "Tag succesfuly inputed to DB";
        ocambaHoodSettings["message"] = message;

        await admin
          .graphql(
            `#graphql
              mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
                metafieldDefinitionCreate(definition: $definition) {
                  createdDefinition {
                    id
                    name
                  }
                  userErrors {
                    field
                    message
                    code
                  }
                }
              }`,
            {
              variables: {
                definition: {
                  name: "Tag",
                  namespace: "analytics",
                  key: "tag",
                  description: "Ocamba Hood Tag",
                  type: "single_line_text_field",
                  ownerType: "SHOP",
                },
              },
            },
          )
          .then((response) => response.json())
          .then(async (data) => {
            await admin
              .graphql(
                `#graphql
                mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafields) {
                    metafields {
                      key
                      namespace
                      value
                      createdAt
                      updatedAt
                    }
                    userErrors {
                      field
                      message
                      code
                    }
                  }
                }`,
                {
                  variables: {
                    metafields: [
                      {
                        key: "tag",
                        namespace: "analytics",
                        ownerId: "gid://shopify/Shop/" + shopId,
                        type: "single_line_text_field",
                        value: ocambaHoodSettings.tag,
                      },
                    ],
                  },
                },
              )
              .then((response) => response.json())
              .then((data) => {
                admin.rest.resources.Theme.all({
                  session: session,
                }).then((response) => {
                  response.data.forEach(async (theme) => {
                    if (theme.role === "main") {
                      const asset = new admin.rest.resources.Asset({
                        session: session,
                      });
                      console.log(asset, theme, session, "657433");

                      asset.theme_id = theme.id;

                      asset.key = "assets/bs.js";
                      asset.value = 'console.log("svi")';
                      console.log(asset);
                      try {
                        await asset.save({
                          update: true,
                        });
                        console.log("gone ok");
                      } catch (error) {
                        console.log("gone bad", error);
                      }
                    }
                  });
                });
              });
          })
          .catch((error) => {
            return json({
              message: "Could not create metafild definition",
            });
          });
      })
      .catch((error) => {
        return json({
          message: "Tag could not be inputed to DB",
        });
      });

    return json(ocambaHoodSettings) ?? null;
  } */

  const { admin, session } = await authenticate.admin(request);
  await admin.rest.resources.Theme.all({
    session: session,
  }).then((response) => {
    response.data.forEach(async (theme) => {
      if (theme.role === "main") {
        const asset = new admin.rest.resources.Asset({
          session: session,
        });
        console.log(admin, session, theme, "657422233");

        asset.theme_id = theme.id;

        asset.key = "assets/bs.js";
        asset.value = 'console.log("svi")';
        console.log(asset);
        try {
          await asset.save({
            update: true,
          });
          console.log("gone ok");
        } catch (error) {
          console.log("gone bad", error);
        }
      }
    });
  });

  return json(ocambaHoodSettings) ?? null;
}

/* function fetchData(url: string) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => {
        response.ok ? resolve(response) : resolve(false);
      })
      .catch((error) => {
        reject(error);
      });
  });
} */

let validationMesage: {
  message: string;
} = { message: "" };

class TagNotValid extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
class NoPresentTagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

class TagTooShortOrTooLong extends Error {
  constructor(message: string) {
    super(message);
  }
}

export default function SettingsPage() {
  const ocambaHoodSettings: any = useLoaderData<typeof loader>();
  const ocambaHoodSettings2: any = useActionData<typeof action>();

  const [formState, setFormState] =
    useState<settingsObject>(ocambaHoodSettings);

  const [toastProps, setToastProps] = useState<string>(
    validationMesage.message,
  );

  useEffect(() => {
    setToastProps(validationMesage.message);
  }, [validationMesage.message]);

  return (
    <Page>
      <TitleBar title="Settings page" />
      <BlockStack gap={{ xs: "800", sm: "400" }}>
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Okamba Hood Tag
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <Form method="POST">
              <BlockStack gap="400">
                <TextField
                  name="tag"
                  label="TAG"
                  value={formState?.tag}
                  onChange={(value) =>
                    setFormState({ ...formState, tag: value })
                  }
                  autoComplete="off"
                  disabled={!formState.active ? true : false}
                />

                <Checkbox
                  label="Activate/Deactivate"
                  name="active"
                  checked={formState?.active}
                  value={formState?.active ? "true" : "false"}
                  onChange={(value) =>
                    setFormState({ ...formState, active: value })
                  }
                />
                <Button
                  submit={true}
                  disabled={!formState.active ? true : false}
                >
                  Save
                </Button>
              </BlockStack>
              <div id="settingsPageToast">{ocambaHoodSettings2?.message}</div>
            </Form>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
