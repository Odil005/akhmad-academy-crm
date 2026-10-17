# Identity-provider integration readiness

## Current implementation
Student enrollment uses face-api embeddings for front/right/left samples. A supervised operator selects the student, confirms guardian consent, starts capture, and the three samples are captured automatically. Matching runs in a staff-authenticated server function. This is local face matching, not certified identity proofing or certified anti-spoofing. Head movements alone do not guarantee resistance to video replay. Production thresholds require trials with the intended camera and students.

## MyID
Official documentation: https://docs.myid.uz/#/
Official onboarding: https://console.myid.uz/ru/integration/
Official product information: https://myid.uz/en/produkty/

MyID documents web biometric capture/liveness and WebSDK options. Production access requires application, confidentiality agreement, transaction package and service contract. Request the current WebSDK integration package and sandbox credentials through MyID's onboarding; keep private credentials in server secrets, never chat or browser bundles. Obtain written confirmation about minor eligibility, guardian consent and permitted biometric-data processing/location before production use. The provider is not connected in this project.

## OneID
Official help: https://id.egov.uz/uz/help
Official overview: https://my.gov.uz/en/page/oneid-about

OneID is federated sign-in, not a drop-in attendance face-recognition engine. Obtain the current relying-party integration package and authorization from the operator before selecting an implementation. Public material reviewed did not establish current protocol endpoints or minor eligibility; do not assume OIDC compatibility. No OneID sign-in is enabled.