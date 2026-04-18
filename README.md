# Mini Laundry Order Management System

A full-stack mini project for managing dry cleaning/laundry orders with dashboard analytics.

## Tech Stack

- Backend: Node.js + Express.js
- Frontend: HTML + CSS + JavaScript + Bootstrap 5
- Database/Persistence: JSON file storage (`data/orders.json`)

## Features

1. Create Orders
- Customer name and phone number
- Multiple garments with quantity
- Hardcoded price list per garment
- Auto bill calculation
- Unique order ID generation

2. Manage Order Status
- Status flow: RECEIVED, PROCESSING, READY, DELIVERED
- API endpoint and UI status update action

3. View Orders
- List all orders in a table
- Search by customer name
- Search by phone
- Filter by status

4. Dashboard
- Total orders
- Total revenue
- Orders per status

5. Bonus Features
- Estimated delivery date support
- Responsive UI (Bootstrap)
- Dark mode toggle with localStorage preference
- JSON persistence for data retention

## Folder Structure

```
mini-laundry-order-management/
|-- data/
|   `-- orders.json
|-- public/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- routes/
|   `-- orders.js
|-- services/
|   `-- orderService.js
|-- package.json
|-- server.js
`-- README.md
```

## API Endpoints

### 1) Create Order
- Method: POST
- URL: `/api/orders/create`
- Body:

```json
{
  "customerName": "Rahul Sharma",
  "phone": "9876543210",
  "garments": [
    { "type": "Shirt", "quantity": 2 },
    { "type": "Pants", "quantity": 1 }
  ],
  "estimatedDeliveryDate": "2026-04-22"
}
```

### 2) Get Orders
- Method: GET
- URL: `/api/orders`
- Optional Query Params:
  - `customerName`
  - `phone`
  - `status`

Examples:
- `/api/orders?customerName=rahul`
- `/api/orders?phone=9876`
- `/api/orders?status=READY`

### 3) Update Order Status
- Method: PUT
- URL: `/api/orders/:id/status`
- Body:

```json
{
  "status": "PROCESSING"
}
```

### 4) Dashboard
- Method: GET
- URL: `/api/dashboard`

## Setup Instructions

1. Open terminal in project root.
2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
npm start
```

4. Open in browser:
- `http://localhost:3000`

For development (auto-restart):

```bash
npm run dev
```

## Hardcoded Price List

- Shirt: Rs. 50
- Pants: Rs. 70
- Saree: Rs. 120
- TShirt: Rs. 40
- Blazer: Rs. 150
- Kurta: Rs. 90

## Notes

- Data is stored in `data/orders.json`.
- This is a mini assignment-oriented project with simple architecture and clear code.

## AI Usage Report

### Prompts Used
- "Act as a senior full stack developer. Build a complete Mini Laundry Order Management System project for my assignment..."

### Where AI Helped
- Created full project structure and boilerplate
- Implemented backend API routes and business logic
- Built responsive frontend with Bootstrap
- Connected frontend to backend APIs
- Generated setup and documentation

### What AI Got Wrong
- Minor UI and wording tweaks may not match exact personal preference.

### What I Fixed Manually
- You can add your exact manual edits here before submission, for example:
- Changed color theme to preferred palette
- Adjusted table column labels
- Updated sample text and assignment formatting

## Author
- Siddhi Jadhav
