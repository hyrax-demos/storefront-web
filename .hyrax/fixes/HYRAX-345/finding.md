# PCI DSS: Raw PAN routed through application backend — full CDE scope

**Tool:** `compliance`
**Severity:** critical
**Category:** security
**Location:** `src/pages/Checkout.tsx:54`

## What's wrong

The checkout flow collects and transmits raw card PANs through the application's own `/checkout` endpoint. Under PCI DSS, any system component that stores, processes, or transmits cardholder data is in scope for the Cardholder Data Environment (CDE). Routing raw PANs through the application backend requires the full SAQ D assessment (or a QSA ROC for larger merchants), covering hundreds of controls. The current architecture violates PCI DSS Requirement 3 (protect stored cardholder data) and Requirement 4 (encrypt transmission of cardholder data across open networks) as a structural design choice, not a single misconfigured setting.
