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

  const { admin, session } = await authenticate.admin(request);
  await admin.rest.resources.Theme.all({
    session: session,
  }).then((response) => {
    response.data.forEach(async (theme) => {
      if (theme.role === "main") {
        const asset = new admin.rest.resources.Asset({
          session: session,
        });
        console.log(admin, session, theme, '________1_______');

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
