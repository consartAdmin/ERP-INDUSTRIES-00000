
           .productsPrices
┌────────────────────────────────────────────────┐
│   product_price_id   INTEGER       PK          │
│   product_code       VARCHAR(50)   NOT NULL    │
│   price_id           INTEGER       NOT NULL    │
│   sale_price         NUMERIC(10,2)             │
│   markup_percent     NUMERIC(5,2)              │
│   gross_profit_pct   NUMERIC(10,2)             │ 
│   created_at         TIMESTAMP                 │ 
│   updated_at         TIMESTAMP                 │
│   user_id            INTEGER                   │
│                                                │
│   UNIQUE (product_code, price_id)              │
└────────────────────────────────────────────────┘   

