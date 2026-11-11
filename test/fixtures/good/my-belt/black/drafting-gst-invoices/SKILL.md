---
name: drafting-gst-invoices
description: Drafts GST-compliant tax invoices for Indian businesses, choosing CGST plus SGST for same-state sales or IGST for interstate sales and checking GSTIN format. Use when the user asks to create, check or fix a GST invoice, bill or tax invoice in India.
license: MIT
metadata:
  author: skillbelt-example
  version: "1.0"
---

# Drafting GST invoices

1. Collect seller and buyer GSTIN, place of supply, items, HSN/SAC codes and rates.
2. Same state as seller → split tax into CGST + SGST. Different state → IGST.
3. Check every GSTIN against the [format rules](references/gstin-format.md).
4. Use the [invoice layout](references/invoice-layout.md) for the final output.

Never invent a GSTIN or HSN code. Ask the user when one is missing.
