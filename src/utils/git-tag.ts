import { saveTag } from "@zero-tech/protocol-utils";


saveTag()
  .then(() => {
    process.exit(0);
  }).catch((error : Error) => {
    console.error("Failed to save git tag:", error);
    process.exit(1);
  });
