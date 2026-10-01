import {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";
/**
 * Programmatic (not declarative/routing) node. This calls
 * httpRequestWithAuthentication directly, which is the same underlying
 * pipeline the declarative `routing` style uses — but doing it explicitly
 * here lets us log the credential's token state via this.logger (which
 * reaches n8n's real log output, unlike console.log from inside a
 * credential's preAuthentication, which may run in a sandboxed context).
 */
export class JumiaVendor implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Jumia Vendor",
    name: "jumiaVendor",
    icon: "file:jumiaVendor.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "Interact with the Jumia Vendor API",
    defaults: {
      name: "Jumia Vendor",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "jumiaOAuth2Api",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Catalog", value: "catalog" },
          { name: "Order", value: "order" },
          { name: "Payment", value: "payment" },
          { name: "Product", value: "product" },
          { name: "Shop", value: "shop" },
        ],
        default: "order",
      },
      // ---------------------------------------------------------------
      // Catalog operations
      // ---------------------------------------------------------------
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: { resource: ["catalog"] },
        },
        options: [
          {
            name: "Retrieve Brands",
            value: "getBrands",
            action: "Retrieve brands",
          },
          {
            name: "Retrieve Categories",
            value: "getCategories",
            action: "Retrieve categories",
          },
          {
            name: "Retrieve Products",
            value: "getProducts",
            action: "Retrieve catalog products",
          },
          {
            name: "Retrieve Attributes",
            value: "getAttributes",
            action: "Retrieve attributes for an attribute set",
          },
          {
            name: "Retrieve Stocks",
            value: "getStocks",
            action: "Retrieve stock records",
          },
          {
            name: "Retrieve Sales Order Item",
            value: "getSalesOrderItem",
            action: "Retrieve a sales order item",
          },
        ],
        default: "getBrands",
      },
      {
        displayName: "Page",
        name: "page",
        type: "number",
        typeOptions: { minValue: 1 },
        default: 1,
        displayOptions: {
          show: {
            resource: ["catalog"],
            operation: ["getBrands", "getCategories"],
          },
        },
        description: "Page number to retrieve",
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: {
          show: { resource: ["catalog"], operation: ["getCategories"] },
        },
        options: [
          {
            displayName: "Size",
            name: "size",
            type: "number",
            typeOptions: { minValue: 1 },
            default: 0,
            description:
              "Number of records per page. Leave at 0 to use the service default.",
          },
          {
            displayName: "Attribute Set Name",
            name: "attributeSetName",
            type: "string",
            default: "",
            description: "Filter categories by attribute set name",
          },
        ],
      },
      {
        displayName: "Return All",
        name: "returnAll",
        type: "boolean",
        default: false,
        displayOptions: {
          show: { resource: ["catalog"], operation: ["getProducts"] },
        },
        description:
          "Whether to return all products by automatically following pagination (via nextToken), or only a single page",
      },
      {
        displayName: "Delay Between Requests (ms)",
        name: "requestDelay",
        type: "number",
        typeOptions: { minValue: 0 },
        default: 0,
        displayOptions: {
          show: {
            resource: ["catalog"],
            operation: ["getProducts"],
            returnAll: [true],
          },
        },
        description:
          "Milliseconds to wait between each paginated request, to help avoid hitting Jumia's rate limits",
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: {
          show: { resource: ["catalog"], operation: ["getProducts"] },
        },
        options: [
          {
            displayName: "Token",
            name: "token",
            type: "string",
            default: "",
            description:
              "Pagination token to navigate to the next page of results",
          },
          {
            displayName: "Size",
            name: "size",
            type: "number",
            typeOptions: { minValue: 1, maxValue: 100 },
            default: 10,
            description: "Number of records to return (1-100)",
          },
          {
            displayName: "Product SIDs",
            name: "sids",
            type: "string",
            default: "",
            placeholder: "sid1,sid2,sid3",
            description: "Comma-separated list of product SIDs to filter in",
          },
          {
            displayName: "Category Code",
            name: "categoryCode",
            type: "number",
            default: 0,
            description: "Category code returned from Retrieve Categories",
          },
          {
            displayName: "Created After",
            name: "createdAtFrom",
            type: "string",
            default: "",
            placeholder: "2020-09-15",
            description: "Creation date filter, from (YYYY-MM-DD)",
          },
          {
            displayName: "Created Before",
            name: "createdAtTo",
            type: "string",
            default: "",
            placeholder: "2020-09-15",
            description: "Creation date filter, to (YYYY-MM-DD)",
          },
          {
            displayName: "Seller SKU",
            name: "sellerSku",
            type: "string",
            default: "",
            description: "Filter products by seller SKU",
          },
          {
            displayName: "Shop Name or ID",
            name: "shopId",
            type: "options",
            typeOptions: {
              loadOptionsMethod: "getShops",
            },
            default: "",
            description:
              'Filter products by shop. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
          },
          {
            displayName: "Status",
            name: "status",
            type: "options",
            options: [
              { name: "Active", value: "ACTIVE" },
              { name: "Inactive", value: "INACTIVE" },
            ],
            default: "ACTIVE",
            description: "Filter products by status",
          },
          {
            displayName: "QC Status",
            name: "qcStatus",
            type: "options",
            options: [
              { name: "Not Ready to QC", value: "NOT_READY_TO_QC" },
              { name: "Pending", value: "PENDING" },
              { name: "Approved", value: "APPROVED" },
              { name: "Rejected", value: "REJECTED" },
            ],
            default: "PENDING",
            description: "Filter products by QC status",
          },
          {
            displayName: "Visible",
            name: "visible",
            type: "boolean",
            default: false,
            description:
              "Whether to filter products by their visibility on the business client",
          },
          {
            displayName: "Latest First",
            name: "latestFirst",
            type: "boolean",
            default: false,
            description:
              "Whether to return the most recently created products first",
          },
        ],
      },
      {
        displayName: "Attribute Set ID",
        name: "attributeSetId",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["catalog"], operation: ["getAttributes"] },
        },
        description: "The Attribute Set ID (UUID) to retrieve attributes for",
      },
      {
        displayName: "Return All",
        name: "returnAll",
        type: "boolean",
        default: false,
        displayOptions: {
          show: { resource: ["catalog"], operation: ["getStocks"] },
        },
        description:
          "Whether to return all stock records by automatically following pagination (via nextToken), or only a single page",
      },
      {
        displayName: "Delay Between Requests (ms)",
        name: "requestDelay",
        type: "number",
        typeOptions: { minValue: 0 },
        default: 0,
        displayOptions: {
          show: {
            resource: ["catalog"],
            operation: ["getStocks"],
            returnAll: [true],
          },
        },
        description:
          "Milliseconds to wait between each paginated request, to help avoid hitting Jumia's rate limits",
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: {
          show: { resource: ["catalog"], operation: ["getStocks"] },
        },
        options: [
          {
            displayName: "Token",
            name: "token",
            type: "string",
            default: "",
            description:
              "Pagination token to navigate to the next page of results",
          },
          {
            displayName: "Size",
            name: "size",
            type: "number",
            typeOptions: { minValue: 1, maxValue: 100 },
            default: 10,
            description: "Number of records to return (1-100)",
          },
          {
            displayName: "Product SIDs",
            name: "productSids",
            type: "string",
            default: "",
            placeholder: "sid1,sid2,sid3",
            description: "Comma-separated list of product SIDs to filter in",
          },
        ],
      },
      {
        displayName: "Order Item Sid",
        name: "orderItemSid",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["catalog"], operation: ["getSalesOrderItem"] },
        },
        description:
          "The Seller Center Order Item Sid, as returned by the GOP Get Order Items API",
      },
      {
        displayName: "Status",
        name: "status",
        type: "options",
        required: true,
        options: [
          { name: "Pending", value: "PENDING" },
          { name: "Shipped", value: "SHIPPED" },
          { name: "Canceled", value: "CANCELED" },
        ],
        default: "PENDING",
        displayOptions: {
          show: { resource: ["catalog"], operation: ["getSalesOrderItem"] },
        },
        description: "Status of the sales order item to retrieve",
      },
      // ---------------------------------------------------------------
      // Order operations
      // ---------------------------------------------------------------
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: { resource: ["order"] },
        },
        options: [
          {
            name: "Get",
            value: "getAll",
            // Defaults to today's createdAt range when no date filters
            // are supplied, but with the Additional Fields it can
            // fetch orders over any period — so "Get" fits better than
            // a label tied to the default behavior.
            action: "Get orders",
          },
          {
            name: "Get Order Items",
            value: "getItems",
            action: "Get order items",
          },
          {
            name: "Cancel",
            value: "cancel",
            action: "Cancel order items",
          },
          { name: "Pack", value: "pack", action: "Pack order items" },
          {
            name: "Print Labels",
            value: "printLabels",
            action: "Print shipping labels",
          },
          {
            name: "Mark as Ready to Ship",
            value: "readyToShip",
            action: "Mark order items as ready to ship",
          },
        ],
        default: "getAll",
      },
      {
        displayName: "Order IDs",
        name: "orderIds",
        type: "string",
        default: "",
        required: true,
        placeholder: "41ea7c3b-20f0-466d-a095-e6e909298180,f94e5592-...",
        description: "Comma-separated list of Order IDs to get items for",
        displayOptions: {
          show: { resource: ["order"], operation: ["getItems"] },
        },
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: {
          show: { resource: ["order"], operation: ["getItems"] },
        },
        options: [
          {
            displayName: "Status",
            name: "status",
            type: "multiOptions",
            options: [
              { name: "Pending", value: "PENDING" },
              { name: "Shipped", value: "SHIPPED" },
              { name: "Canceled", value: "CANCELED" },
              { name: "Returned", value: "RETURNED" },
              { name: "Failed", value: "FAILED" },
              { name: "Delivered", value: "DELIVERED" },
              { name: "Ready to Ship", value: "READY_TO_SHIP" },
            ],
            default: [],
            description:
              "Filter by order item status. Leave empty to retrieve every status.",
          },
          {
            displayName: "Shop Name or ID",
            name: "shopId",
            type: "options",
            typeOptions: {
              loadOptionsMethod: "getShops",
            },
            default: "",
            description:
              'Filter items belonging to a single shop (for mastershop users). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
          },
        ],
      },
      {
        displayName: "Order Item IDs",
        name: "orderItemIds",
        type: "string",
        default: "",
        required: true,
        placeholder: "acadee72-28a1-4280-903a-e56a0cc0acc4,...",
        description: "Comma-separated list of Order Item IDs to cancel",
        displayOptions: {
          show: { resource: ["order"], operation: ["cancel"] },
        },
      },
      {
        displayName: "Order Items",
        name: "orderItemsJson",
        type: "json",
        default: '[\n  {\n    "id": "",\n    "shipmentProviderId": ""\n  }\n]',
        required: true,
        description:
          "Array of {id, shipmentProviderId} objects — the order items to pack. All items must share the same country, shipment provider, shipment method, and payment method type, and none can be Fulfilled by Jumia (dropshipping).",
        displayOptions: {
          show: { resource: ["order"], operation: ["pack"] },
        },
      },
      {
        displayName: "Order Item IDs",
        name: "orderItemIds",
        type: "string",
        default: "",
        required: true,
        placeholder: "acadee72-28a1-4280-903a-e56a0cc0acc4,...",
        description:
          "Comma-separated list of Order Item IDs to print labels for (max 200)",
        displayOptions: {
          show: { resource: ["order"], operation: ["printLabels"] },
        },
      },
      {
        displayName: "Order Item IDs",
        name: "orderItemIds",
        type: "string",
        default: "",
        required: true,
        placeholder: "acadee72-28a1-4280-903a-e56a0cc0acc4,...",
        description:
          "Comma-separated list of Order Item IDs to mark as ready to ship",
        displayOptions: {
          show: { resource: ["order"], operation: ["readyToShip"] },
        },
      },
      {
        displayName: "Return All",
        name: "returnAll",
        type: "boolean",
        default: false,
        displayOptions: {
          show: { resource: ["order"], operation: ["getAll"] },
        },
        description:
          "Whether to return all orders by automatically following pagination (via nextToken), or only a single page",
      },
      {
        displayName: "Delay Between Requests (ms)",
        name: "requestDelay",
        type: "number",
        typeOptions: { minValue: 0 },
        default: 0,
        displayOptions: {
          show: {
            resource: ["order"],
            operation: ["getAll"],
            returnAll: [true],
          },
        },
        description:
          "Milliseconds to wait between each paginated request, to help avoid hitting Jumia's rate limits",
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: {
          show: { resource: ["order"], operation: ["getAll"] },
        },
        options: [
          {
            displayName: "Status",
            name: "status",
            type: "multiOptions",
            options: [
              { name: "Pending", value: "PENDING" },
              { name: "Shipped", value: "SHIPPED" },
              { name: "Canceled", value: "CANCELED" },
              { name: "Returned", value: "RETURNED" },
              { name: "Failed", value: "FAILED" },
              { name: "Delivered", value: "DELIVERED" },
              { name: "Ready to Ship", value: "READY_TO_SHIP" },
            ],
            default: [],
            description:
              "Filter by order item status. Leave empty to retrieve every status.",
          },
          {
            displayName: "Country",
            name: "country",
            type: "multiOptions",
            options: [
              { name: "Ivory Coast (CI)", value: "CI" },
              { name: "Algeria (DZ)", value: "DZ" },
              { name: "Egypt (EG)", value: "EG" },
              { name: "Ghana (GH)", value: "GH" },
              { name: "Kenya (KE)", value: "KE" },
              { name: "Morocco (MA)", value: "MA" },
              { name: "Nigeria (NG)", value: "NG" },
              { name: "Senegal (SN)", value: "SN" },
              { name: "Tunisia (TN)", value: "TN" },
              { name: "Uganda (UG)", value: "UG" },
              { name: "South Africa (ZA)", value: "ZA" },
            ],
            default: [],
            description:
              "Filter by country. Leave empty to retrieve every country.",
          },
          {
            displayName: "Shop Name or ID",
            name: "shopId",
            type: "options",
            typeOptions: {
              loadOptionsMethod: "getShops",
            },
            default: "",
            description:
              'Filter orders belonging to a single shop (for mastershop users). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
          },
          {
            displayName: "Created After",
            name: "createdAfter",
            type: "string",
            default: "",
            placeholder: "2022-05-20 22:30:00",
            description:
              "Start of createdAt date to filter. Range can't exceed 3 months. Cannot be combined with Updated After/Before.",
          },
          {
            displayName: "Created Before",
            name: "createdBefore",
            type: "string",
            default: "",
            placeholder: "2022-05-20 22:30:00",
            description:
              "End of createdAt date to filter. Range can't exceed 3 months. Cannot be combined with Updated After/Before.",
          },
          {
            displayName: "Updated After",
            name: "updatedAfter",
            type: "string",
            default: "",
            placeholder: "2022-05-20 22:30:00",
            description:
              "Start of updatedAt date to filter. Range can't exceed 3 months. Cannot be combined with Created After/Before.",
          },
          {
            displayName: "Updated Before",
            name: "updatedBefore",
            type: "string",
            default: "",
            placeholder: "2022-05-20 22:30:00",
            description:
              "End of updatedAt date to filter. Range can't exceed 3 months. Cannot be combined with Created After/Before.",
          },
          {
            displayName: "Size",
            name: "size",
            type: "number",
            typeOptions: { minValue: 1, maxValue: 300 },
            default: 100,
            description: "Number of orders to return per page (max 300)",
          },
          {
            displayName: "Sort",
            name: "sort",
            type: "options",
            options: [
              { name: "ASC", value: "ASC" },
              { name: "DESC", value: "DESC" },
            ],
            default: "ASC",
            description: "Sort direction, by creation date",
          },
          {
            displayName: "Token",
            name: "token",
            type: "string",
            default: "",
            description:
              "Pagination token to navigate to the next page of results (from a previous response's nextToken)",
          },
        ],
      },
      // ---------------------------------------------------------------
      // Payment operations
      // ---------------------------------------------------------------
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: { resource: ["payment"] },
        },
        options: [
          {
            name: "Get Payout Statement",
            value: "getPayoutStatement",
            action: "Get payout statement",
          },
        ],
        default: "getPayoutStatement",
      },
      {
        displayName: "Page",
        name: "page",
        type: "number",
        typeOptions: { minValue: 1 },
        default: 1,
        displayOptions: {
          show: { resource: ["payment"], operation: ["getPayoutStatement"] },
        },
        description: "Page number for pagination",
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: {
          show: { resource: ["payment"], operation: ["getPayoutStatement"] },
        },
        options: [
          {
            displayName: "Created After",
            name: "createdAfter",
            type: "string",
            default: "",
            placeholder: "2025-01-01 or 2025-05-20 22:30:00",
            description:
              "Filter statements created after this date (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss). Defaults to 90 days ago if not specified.",
          },
          {
            displayName: "Size",
            name: "size",
            type: "number",
            typeOptions: { minValue: 1, maxValue: 1000 },
            default: 50,
            description: "Number of results per page (max 1000)",
          },
          {
            displayName: "Paid",
            name: "paid",
            type: "boolean",
            default: true,
            description: "Whether to filter by payment status",
          },
          {
            displayName: "Country",
            name: "country",
            type: "options",
            options: [
              { name: "Ivory Coast (CI)", value: "CI" },
              { name: "Algeria (DZ)", value: "DZ" },
              { name: "Egypt (EG)", value: "EG" },
              { name: "Ghana (GH)", value: "GH" },
              { name: "Kenya (KE)", value: "KE" },
              { name: "Morocco (MA)", value: "MA" },
              { name: "Nigeria (NG)", value: "NG" },
              { name: "Senegal (SN)", value: "SN" },
              { name: "Tunisia (TN)", value: "TN" },
              { name: "Uganda (UG)", value: "UG" },
              { name: "South Africa (ZA)", value: "ZA" },
            ],
            default: "GH",
            description: "Filter by country",
          },
          {
            displayName: "Currency",
            name: "currency",
            type: "options",
            options: [
              { name: "Local", value: "LOCAL" },
              { name: "USD", value: "USD" },
            ],
            default: "USD",
            description:
              "Return amounts in local currency or USD. Default is USD.",
          },
        ],
      },
      // ---------------------------------------------------------------
      // Product operations
      // ---------------------------------------------------------------
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: { resource: ["product"] },
        },
        options: [
          { name: "Create", value: "create", action: "Create a product" },
          { name: "Update", value: "update", action: "Update a product" },
          {
            name: "Update Stock",
            value: "updateStock",
            action: "Update product stock",
          },
          {
            name: "Update Price",
            value: "updatePrice",
            action: "Update product price",
          },
          {
            name: "Update Status",
            value: "updateStatus",
            action: "Update product status",
          },
          {
            name: "Get Feed Status",
            value: "getFeedStatus",
            action: "Get the status of a feed",
          },
        ],
        default: "create",
      },
      {
        displayName: "Shop Name or ID",
        name: "shopId",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getShops",
        },
        default: "",
        required: true,
        description:
          'Which shop to create the product(s) under. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        displayOptions: {
          show: { resource: ["product"], operation: ["create"] },
        },
      },
      {
        displayName: "Products",
        name: "productsJson",
        type: "json",
        default: "[\n  {\n\n  }\n]",
        required: true,
        description:
          "Array of product objects to create, matching the Jumia Create Products feed schema (name, description, parentSku, sellerSku, category, price, stock, attributes, etc.)",
        displayOptions: {
          show: { resource: ["product"], operation: ["create"] },
        },
      },
      {
        displayName: "Shop Name or ID",
        name: "shopId",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getShops",
        },
        default: "",
        description:
          'Optional. Which shop the update applies to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        displayOptions: {
          show: { resource: ["product"], operation: ["update"] },
        },
      },
      {
        displayName: "Products",
        name: "productsJson",
        type: "json",
        default: "[\n  {\n\n  }\n]",
        required: true,
        description:
          "Array of product objects to update, matching the Jumia Update Products feed schema. Main image, main category, and parent SKU cannot be changed this way — only additional categories, brand, config attributes, GTIN barcode, simple attributes, and variation.",
        displayOptions: {
          show: { resource: ["product"], operation: ["update"] },
        },
      },
      {
        displayName: "Products",
        name: "productsJson",
        type: "json",
        default:
          '[\n  {\n    "sellerSku": "",\n    "id": "",\n    "stock": 0\n  }\n]',
        required: true,
        description:
          "Array of {sellerSku, id, stock} objects, one per product, to update stock for",
        displayOptions: {
          show: { resource: ["product"], operation: ["updateStock"] },
        },
      },
      {
        displayName: "Products",
        name: "productsJson",
        type: "json",
        default:
          '[\n  {\n    "sellerSku": "",\n    "id": "",\n    "category": "",\n    "price": {}\n  }\n]',
        required: true,
        description:
          "Array of product price objects to update, matching the Jumia Update Product Price feed schema. Global price overrides local (businessClients) prices when local prices aren't present on the payload. To clear a global sale price, set price.salePrice.value, price.salePrice.startAt, and price.salePrice.endAt to null.",
        displayOptions: {
          show: { resource: ["product"], operation: ["updatePrice"] },
        },
      },
      {
        displayName: "Products",
        name: "productsJson",
        type: "json",
        default:
          '[\n  {\n    "sellerSku": "",\n    "id": "",\n    "createdAt": "",\n    "businessClients": [\n      { "businessClientCode": "", "status": "ACTIVE" }\n    ]\n  }\n]',
        required: true,
        description:
          "Array of product status objects to update, matching the Jumia Update Product Status feed schema",
        displayOptions: {
          show: { resource: ["product"], operation: ["updateStatus"] },
        },
      },
      {
        displayName: "Feed ID",
        name: "feedId",
        type: "string",
        default: "",
        required: true,
        description:
          "ID of the feed to check (returned when a create/update/stock/price/status feed request is submitted)",
        displayOptions: {
          show: { resource: ["product"], operation: ["getFeedStatus"] },
        },
      },
      // ---------------------------------------------------------------
      // Shop operations
      // ---------------------------------------------------------------
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: {
          show: { resource: ["shop"] },
        },
        options: [
          {
            name: "Get Many",
            value: "getAll",
            action: "Get many shops",
          },
          {
            name: "Get Many (Master Shop)",
            value: "getAllMasterShop",
            action: "Get many shops under the master shop",
          },
        ],
        default: "getAll",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getShops(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const response = await this.helpers.httpRequestWithAuthentication.call(
          this,
          "jumiaOAuth2Api",
          {
            method: "GET",
            baseURL: "https://vendor-api.jumia.com",
            url: "/shops",
            headers: { Accept: "application/json" },
            json: true,
          },
        );

        // The endpoint isn't documented beyond "200 OK" for the body
        // shape, so handle either a bare array or a { data: [...] }
        // envelope, and try the most likely id/name key variants.
        const shops: IDataObject[] = Array.isArray(response)
          ? (response as IDataObject[])
          : (((response as IDataObject)?.data as IDataObject[]) ?? []);

        return shops.map((shop) => {
          const id =
            (shop.id as string) ??
            (shop.shopId as string) ??
            (shop.shop_id as string) ??
            "";
          const name =
            (shop.name as string) ??
            (shop.shopName as string) ??
            (shop.shop_name as string) ??
            id;

          return { name, value: id };
        });
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter("resource", i) as string;
      const operation = this.getNodeParameter("operation", i) as string;

      // Diagnostic: log credential token state BEFORE the authenticated
      // call, so we can see in n8n's actual log output (not just the
      // UI error panel) whether a token is present at this point.
      const credsBefore = (await this.getCredentials(
        "jumiaOAuth2Api",
      )) as IDataObject;
      this.logger.info(
        `[Jumia] Before request — accessToken present: ${!!credsBefore.accessToken}, length: ${
          (credsBefore.accessToken as string)?.length ?? 0
        }`,
      );

      let requestOptions: IHttpRequestOptions;

      // Shared helpers used by several operations below.
      const parseJsonArray = (raw: string, index: number): IDataObject[] => {
        try {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          throw new NodeOperationError(
            this.getNode(),
            `JSON field is not valid JSON: ${(error as Error).message}`,
            { itemIndex: index },
          );
        }
      };
      const splitCsv = (raw: string): string[] =>
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      const sleep = (ms: number): Promise<void> =>
        new Promise((resolve) => setTimeout(resolve, ms));
      // Shared pagination loop for the token/nextToken pattern used by
      // GET /orders, GET /catalog/products, and GET /catalog/stock.
      // Follows nextToken until the API reports isLastPage (or stops
      // returning a token), pushing every item from every page.
      const paginateWithToken = async (
        url: string,
        baseQs: IDataObject,
        startToken: string | undefined,
        delayMs: number,
        itemsKey: string,
      ): Promise<void> => {
        let token = startToken;
        let isLastPage = false;
        let pageCount = 0;
        const maxPages = 1000; // safety cap against a runaway loop

        try {
          while (!isLastPage && pageCount < maxPages) {
            // Don't delay before the first request — only between
            // subsequent pages, which is what actually risks a rate limit.
            if (pageCount > 0 && delayMs > 0) {
              await sleep(delayMs);
            }

            const qs: IDataObject = { ...baseQs };
            if (token) qs.token = token;

            const response =
              (await this.helpers.httpRequestWithAuthentication.call(
                this,
                "jumiaOAuth2Api",
                {
                  method: "GET",
                  baseURL: "https://vendor-api.jumia.com",
                  url,
                  headers: { Accept: "application/json" },
                  qs,
                  json: true,
                },
              )) as IDataObject;

            const pageItems = (response[itemsKey] ?? []) as IDataObject[];
            for (const entry of pageItems) {
              returnData.push({ json: entry });
            }

            token = response.nextToken as string | undefined;
            isLastPage = response.isLastPage === true || !token;
            pageCount++;
          }

          const credsAfter = (await this.getCredentials(
            "jumiaOAuth2Api",
          )) as IDataObject;
          this.logger.info(
            `[Jumia] After request — accessToken present: ${!!credsAfter.accessToken}, length: ${
              (credsAfter.accessToken as string)?.length ?? 0
            }`,
          );
        } catch (error) {
          this.logger.error(
            `[Jumia] Request failed: ${(error as Error).message}`,
          );
          throw error;
        }
      };

      if (resource === "order" && operation === "getAll") {
        const additionalFields = this.getNodeParameter(
          "additionalFields",
          i,
          {},
        ) as IDataObject;
        const returnAll = this.getNodeParameter(
          "returnAll",
          i,
          false,
        ) as boolean;
        const requestDelay = this.getNodeParameter(
          "requestDelay",
          i,
          0,
        ) as number;

        const baseQs: IDataObject = {};
        const status = additionalFields.status as string[] | undefined;
        if (status?.length) baseQs.status = status.join(",");

        const country = additionalFields.country as string[] | undefined;
        if (country?.length) baseQs.country = country.join(",");

        if (additionalFields.shopId) baseQs.shopId = additionalFields.shopId;
        if (additionalFields.createdAfter)
          baseQs.createdAfter = additionalFields.createdAfter;
        if (additionalFields.createdBefore)
          baseQs.createdBefore = additionalFields.createdBefore;
        if (additionalFields.updatedAfter)
          baseQs.updatedAfter = additionalFields.updatedAfter;
        if (additionalFields.updatedBefore)
          baseQs.updatedBefore = additionalFields.updatedBefore;
        if (additionalFields.size) baseQs.size = additionalFields.size;
        if (additionalFields.sort) baseQs.sort = additionalFields.sort;

        if (returnAll) {
          await paginateWithToken(
            "/orders",
            baseQs,
            additionalFields.token as string | undefined,
            requestDelay,
            "orders",
          );
          continue;
        }

        const qs: IDataObject = { ...baseQs };
        if (additionalFields.token) qs.token = additionalFields.token;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/orders",
          headers: { Accept: "application/json" },
          qs,
          json: true,
        };
      } else if (resource === "order" && operation === "getItems") {
        const orderIds = splitCsv(
          this.getNodeParameter("orderIds", i) as string,
        );
        const additionalFields = this.getNodeParameter(
          "additionalFields",
          i,
          {},
        ) as IDataObject;

        const qs: IDataObject = { orderId: orderIds };
        const status = additionalFields.status as string[] | undefined;
        if (status?.length) qs.status = status.join(",");
        if (additionalFields.shopId) qs.shopId = additionalFields.shopId;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/orders/items",
          headers: { Accept: "application/json" },
          qs,
          json: true,
        };
      } else if (resource === "order" && operation === "cancel") {
        const orderItemIds = splitCsv(
          this.getNodeParameter("orderItemIds", i) as string,
        );

        requestOptions = {
          method: "PUT",
          baseURL: "https://vendor-api.jumia.com",
          url: "/orders/cancel",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: { orderItemIds },
          json: true,
        };
      } else if (resource === "order" && operation === "pack") {
        const orderItems = parseJsonArray(
          this.getNodeParameter("orderItemsJson", i) as string,
          i,
        );

        requestOptions = {
          method: "POST",
          baseURL: "https://vendor-api.jumia.com",
          url: "/orders/pack",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: { orderItems },
          json: true,
        };
      } else if (resource === "order" && operation === "printLabels") {
        const orderItemIds = splitCsv(
          this.getNodeParameter("orderItemIds", i) as string,
        );

        requestOptions = {
          method: "POST",
          baseURL: "https://vendor-api.jumia.com",
          url: "/orders/print-labels",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: { orderItemIds },
          json: true,
        };
      } else if (resource === "order" && operation === "readyToShip") {
        const orderItemIds = splitCsv(
          this.getNodeParameter("orderItemIds", i) as string,
        );

        requestOptions = {
          method: "POST",
          baseURL: "https://vendor-api.jumia.com",
          url: "/orders/ready-to-ship",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: { orderItemIds },
          json: true,
        };
      } else if (
        resource === "product" &&
        (operation === "create" ||
          operation === "update" ||
          operation === "updateStock" ||
          operation === "updatePrice" ||
          operation === "updateStatus")
      ) {
        const products = parseJsonArray(
          this.getNodeParameter("productsJson", i) as string,
          i,
        );

        const body: IDataObject = { products };

        // shopId is required on create, optional on update, and not
        // part of the stock/price/status feed schemas at all.
        if (operation === "create" || operation === "update") {
          const shopId = this.getNodeParameter("shopId", i, "") as string;
          if (shopId) body.shopId = shopId;
        }

        const urlByOperation: Record<string, string> = {
          create: "/feeds/products/create",
          update: "/feeds/products/update",
          updateStock: "/feeds/products/stock",
          updatePrice: "/feeds/products/price",
          updateStatus: "/feeds/products/status",
        };

        requestOptions = {
          method: "POST",
          baseURL: "https://vendor-api.jumia.com",
          url: urlByOperation[operation],
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body,
          json: true,
        };
      } else if (resource === "product" && operation === "getFeedStatus") {
        const feedId = this.getNodeParameter("feedId", i) as string;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: `/feeds/${feedId}`,
          headers: { Accept: "application/json" },
          json: true,
        };
      } else if (resource === "catalog" && operation === "getBrands") {
        const page = this.getNodeParameter("page", i, 1) as number;
        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/catalog/brands",
          headers: { Accept: "application/json" },
          qs: { page },
          json: true,
        };
      } else if (resource === "catalog" && operation === "getCategories") {
        const page = this.getNodeParameter("page", i, 1) as number;
        const additionalFields = this.getNodeParameter(
          "additionalFields",
          i,
          {},
        ) as IDataObject;

        const qs: IDataObject = { page };
        if (additionalFields.size) qs.size = additionalFields.size;
        if (additionalFields.attributeSetName)
          qs.attributeSetName = additionalFields.attributeSetName;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/catalog/categories",
          headers: { Accept: "application/json" },
          qs,
          json: true,
        };
      } else if (resource === "catalog" && operation === "getProducts") {
        const additionalFields = this.getNodeParameter(
          "additionalFields",
          i,
          {},
        ) as IDataObject;
        const returnAll = this.getNodeParameter(
          "returnAll",
          i,
          false,
        ) as boolean;
        const requestDelay = this.getNodeParameter(
          "requestDelay",
          i,
          0,
        ) as number;

        const baseQs: IDataObject = {};
        if (additionalFields.size) baseQs.size = additionalFields.size;
        const sids = additionalFields.sids as string | undefined;
        if (sids) baseQs.sids = splitCsv(sids);
        if (additionalFields.categoryCode)
          baseQs.categoryCode = additionalFields.categoryCode;
        if (additionalFields.createdAtFrom)
          baseQs.createdAtFrom = additionalFields.createdAtFrom;
        if (additionalFields.createdAtTo)
          baseQs.createdAtTo = additionalFields.createdAtTo;
        if (additionalFields.sellerSku)
          baseQs.sellerSku = additionalFields.sellerSku;
        if (additionalFields.shopId) baseQs.shopId = additionalFields.shopId;
        if (additionalFields.status) baseQs.status = additionalFields.status;
        if (additionalFields.qcStatus)
          baseQs.qcStatus = additionalFields.qcStatus;
        if (additionalFields.visible !== undefined)
          baseQs.visible = additionalFields.visible;
        if (additionalFields.latestFirst !== undefined)
          baseQs.latestFirst = additionalFields.latestFirst;

        if (returnAll) {
          // Same "Next token" pagination as GOP Get Orders — follow
          // nextToken until isLastPage (or no token comes back).
          let token = additionalFields.token as string | undefined;
          let isLastPage = false;
          let pageCount = 0;
          const maxPages = 1000; // safety cap against a runaway loop

          try {
            while (!isLastPage && pageCount < maxPages) {
              if (pageCount > 0 && requestDelay > 0) {
                await sleep(requestDelay);
              }

              const qs: IDataObject = { ...baseQs };
              if (token) qs.token = token;

              const response =
                (await this.helpers.httpRequestWithAuthentication.call(
                  this,
                  "jumiaOAuth2Api",
                  {
                    method: "GET",
                    baseURL: "https://vendor-api.jumia.com",
                    url: "/catalog/products",
                    headers: { Accept: "application/json" },
                    qs,
                    json: true,
                  },
                )) as IDataObject;

              // Unconfirmed against a live response — following the
              // pattern that held for /orders, /catalog/brands, and
              // /catalog/categories, where the array sits under a key
              // matching the endpoint's last path segment.
              const pageItems = (response.products ?? []) as IDataObject[];
              for (const productItem of pageItems) {
                returnData.push({ json: productItem });
              }

              token = response.nextToken as string | undefined;
              isLastPage = response.isLastPage === true || !token;
              pageCount++;
            }

            const credsAfter = (await this.getCredentials(
              "jumiaOAuth2Api",
            )) as IDataObject;
            this.logger.info(
              `[Jumia] After request — accessToken present: ${!!credsAfter.accessToken}, length: ${
                (credsAfter.accessToken as string)?.length ?? 0
              }`,
            );
          } catch (error) {
            this.logger.error(
              `[Jumia] Request failed: ${(error as Error).message}`,
            );
            throw error;
          }

          continue;
        }

        const qs: IDataObject = { ...baseQs };
        if (additionalFields.token) qs.token = additionalFields.token;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/catalog/products",
          headers: { Accept: "application/json" },
          qs,
          json: true,
        };
      } else if (resource === "catalog" && operation === "getAttributes") {
        const attributeSetId = this.getNodeParameter(
          "attributeSetId",
          i,
        ) as string;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: `/catalog/attribute-sets/${attributeSetId}`,
          headers: { Accept: "application/json" },
          json: true,
        };
      } else if (resource === "catalog" && operation === "getStocks") {
        const additionalFields = this.getNodeParameter(
          "additionalFields",
          i,
          {},
        ) as IDataObject;
        const returnAll = this.getNodeParameter(
          "returnAll",
          i,
          false,
        ) as boolean;
        const requestDelay = this.getNodeParameter(
          "requestDelay",
          i,
          0,
        ) as number;

        const baseQs: IDataObject = {};
        if (additionalFields.size) baseQs.size = additionalFields.size;
        const productSids = additionalFields.productSids as string | undefined;
        if (productSids) baseQs.productSids = splitCsv(productSids);

        if (returnAll) {
          let token = additionalFields.token as string | undefined;
          let isLastPage = false;
          let pageCount = 0;
          const maxPages = 1000; // safety cap against a runaway loop

          try {
            while (!isLastPage && pageCount < maxPages) {
              if (pageCount > 0 && requestDelay > 0) {
                await sleep(requestDelay);
              }

              const qs: IDataObject = { ...baseQs };
              if (token) qs.token = token;

              const response =
                (await this.helpers.httpRequestWithAuthentication.call(
                  this,
                  "jumiaOAuth2Api",
                  {
                    method: "GET",
                    baseURL: "https://vendor-api.jumia.com",
                    url: "/catalog/stock",
                    headers: { Accept: "application/json" },
                    qs,
                    json: true,
                  },
                )) as IDataObject;

              // Unconfirmed against a live response — guessing "stock"
              // to match the endpoint's last path segment, the same
              // pattern confirmed for /orders.
              const pageItems = (response.products ?? []) as IDataObject[];
              for (const stockItem of pageItems) {
                returnData.push({ json: stockItem });
              }

              token = response.nextToken as string | undefined;
              isLastPage = response.isLastPage === true || !token;
              pageCount++;
            }

            const credsAfter = (await this.getCredentials(
              "jumiaOAuth2Api",
            )) as IDataObject;
            this.logger.info(
              `[Jumia] After request — accessToken present: ${!!credsAfter.accessToken}, length: ${
                (credsAfter.accessToken as string)?.length ?? 0
              }`,
            );
          } catch (error) {
            this.logger.error(
              `[Jumia] Request failed: ${(error as Error).message}`,
            );
            throw error;
          }

          continue;
        }

        const qs: IDataObject = { ...baseQs };
        if (additionalFields.token) qs.token = additionalFields.token;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/catalog/stock",
          headers: { Accept: "application/json" },
          qs,
          json: true,
        };
      } else if (resource === "catalog" && operation === "getSalesOrderItem") {
        const orderItemSid = this.getNodeParameter("orderItemSid", i) as string;
        const status = this.getNodeParameter("status", i) as string;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: `/catalog/stock/salesorderitem/${orderItemSid}`,
          headers: { Accept: "application/json" },
          qs: { status },
          json: true,
        };
      } else if (resource === "payment" && operation === "getPayoutStatement") {
        const page = this.getNodeParameter("page", i, 1) as number;
        const additionalFields = this.getNodeParameter(
          "additionalFields",
          i,
          {},
        ) as IDataObject;

        const qs: IDataObject = { page };
        if (additionalFields.createdAfter)
          qs.createdAfter = additionalFields.createdAfter;
        if (additionalFields.size) qs.size = additionalFields.size;
        if (additionalFields.paid !== undefined)
          qs.paid = additionalFields.paid;
        if (additionalFields.country) qs.country = additionalFields.country;
        if (additionalFields.currency) qs.currency = additionalFields.currency;

        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/payout-statement",
          headers: { Accept: "application/json" },
          qs,
          json: true,
        };
      } else if (resource === "shop" && operation === "getAll") {
        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/shops",
          headers: { Accept: "application/json" },
          json: true,
        };
      } else if (resource === "shop" && operation === "getAllMasterShop") {
        requestOptions = {
          method: "GET",
          baseURL: "https://vendor-api.jumia.com",
          url: "/shops-of-master-shop",
          headers: { Accept: "application/json" },
          json: true,
        };
      } else {
        throw new NodeOperationError(
          this.getNode(),
          `Unsupported resource/operation: ${resource}/${operation}`,
          { itemIndex: i },
        );
      }

      try {
        const response = await this.helpers.httpRequestWithAuthentication.call(
          this,
          "jumiaOAuth2Api",
          requestOptions,
        );

        // Diagnostic: log token state AFTER, to see if preAuthentication
        // updated it as part of this call.
        const credsAfter = (await this.getCredentials(
          "jumiaOAuth2Api",
        )) as IDataObject;
        this.logger.info(
          `[Jumia] After request — accessToken present: ${!!credsAfter.accessToken}, length: ${
            (credsAfter.accessToken as string)?.length ?? 0
          }`,
        );

        // /shops and /shops-of-master-shop can return a bare array;
        // wrap so every item lands as its own output item like the
        // rest of the node's responses do.
        if (Array.isArray(response)) {
          for (const entry of response as IDataObject[]) {
            returnData.push({ json: entry });
          }
        } else {
          returnData.push({ json: response as IDataObject });
        }
      } catch (error) {
        this.logger.error(
          `[Jumia] Request failed: ${(error as Error).message}`,
        );
        throw error;
      }
    }

    return [returnData];
  }
}
