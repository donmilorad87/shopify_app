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
  Tooltip,
} from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { useState } from "react";
//import prisma db
import db from "../db.server";

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

type settingsObject = {
  id?: string;
  tag: string;
  active: boolean;
  message?: string;
  swAddress?: string;
};

type validationMesageType = {
  message: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  //get data from db
  const { admin, session } = await authenticate.admin(request);

  let shopInfo = await admin.rest.resources.Shop.all({
    session: session,
  });

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

  if (ocambaHoodSettings.tag === "") {
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
    shopId = shopInfo.data[0].id.toString();

    let message = "Tag succesfuly inputed to DB.";
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
      .then(async () => {
        let message = "Metafiled defintion succesfuly created.";
        ocambaHoodSettings["message"] += message;

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
          .then(async (data) => {
            let message = "Metafiled key data setted.";
            ocambaHoodSettings["message"] += message;

            await admin.rest.resources.Theme.all({
              session: session,
            })
              .then(async (response) => {
                response.data.forEach(async (theme) => {
                  if (theme.role === "main") {
                    await admin.rest.resources.Asset.all({
                      session: session,
                      theme_id: theme.id,
                    }).then((response) => {
                      console.log(response, "assets");
                      response.data.forEach(async (asset) => {
                        if (asset.key === "assets/sw.js") {
                          console.log(asset.public_url);

                          // Find the index of the substring '/t/l'
                          if (asset.public_url) {
                            let index = asset.public_url.indexOf("/t/1");

                            // Extract the part of the string after '/t/l'
                            let afterTL = (
                              "/cdn/shop" + asset.public_url.substring(index)
                            ).split("?")[0];

                            console.log(afterTL.split("?")[0]);

                            await db.settings
                              .upsert({
                                where: {
                                  id: shopId,
                                },
                                update: {
                                  id: shopId,
                                  tag: ocambaHoodSettings.tag,
                                  active:
                                    ocambaHoodSettings.active === "true"
                                      ? true
                                      : false,
                                  swAddress: afterTL,
                                },
                                create: {
                                  id: shopId,
                                  tag: ocambaHoodSettings.tag,
                                  active:
                                    ocambaHoodSettings.active === "true"
                                      ? true
                                      : false,
                                  swAddress: afterTL,
                                },
                              })
                              .then(async () => {
                                let message = "Tag succesfuly inputed to DB.2";
                                ocambaHoodSettings["message"] += message;
                              })
                              .catch((error) => {
                                return json({
                                  message: "Tag could not be inputed to DB",
                                });
                              });
                          }
                        }
                      });
                    });

                    /* try {
                       
                          const asset = new admin.rest.resources.Asset({
                            session: session,
                          });
                           console.log(asset, theme, session, "657433");
                          console.log(161026277680, theme.id, theme.id === 161026277680);
                          
                          asset.theme_id = theme.id;

                          asset.key = 'assets/sw.js';
                          asset.value = 'importScripts("https://cdn.ocmhood.com/sdk/osw.js");';
                          console.log(asset);
                          
                          let seper = await asset.save({
                            update: true,
                          })
                          console.log("gone ok", seper);
                          let message = ", Sw.js succesfuly created.";
                          ocambaHoodSettings["message"] += message;
                        } catch (error) {
                          console.log("gone bad", error);
                          let message = ", Sw.js not created.";
                          ocambaHoodSettings["message"] += message;
                        } */
                  }
                });
              })
              .catch((error) => {
                return json({
                  message: "Could not create theme asset sw.js",
                });
              });
          })
          .catch((error) => {
            return json({
              message: "Could not create metafield",
            });
          });
      })
      .catch((error) => {
        return json({
          message: "Could not create metafild definition",
        });
      });

    return json(ocambaHoodSettings);
  }
}

function fetchData(url: string) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => {
        response.ok ? resolve(response) : resolve(false);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

let validationMesage: validationMesageType = { message: "" };

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
  const loaderData: any = useLoaderData<typeof loader>();
  const actionData: any = useActionData<typeof action>();

  const [formState, setFormState] = useState<settingsObject>(loaderData);

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
                <Tooltip active content="This order has shipping labels.">
                  <Text fontWeight="bold" as="span">
                    Order #1001
                  </Text>
                </Tooltip>
                <TextField
                  label=""
                  value={formState?.swAddress}
                  disabled
                  autoComplete="off"
                />

                <Button
                  submit={true}
                  disabled={!formState.active ? true : false}
                >
                  Save
                </Button>
              </BlockStack>
              <div id="settingsPageToast">{actionData?.message}</div>
            </Form>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
