import { ethers } from "hardhat";
import { contractNames } from "../../deploy";
import { decodeCustomError, IContractDecoderInput } from "@zero-tech/protocol-utils";


const getContractsDecoderInput = async () : Promise<Array<IContractDecoderInput>> =>
  (Object.values(contractNames) as Array<{ contract : string; instance : string; }>).reduce(
    async (
      acc : Promise<Array<IContractDecoderInput>>,
      { contract } : { contract : string; instance : string; },
    ) => {
      const newAcc = await acc;

      const factory = await ethers.getContractFactory(contract);

      return [
        ...newAcc,
        {
          name: contract,
          factory,
        },
      ];
    }, Promise.resolve([])
  );

const decode = async () => {
  const contractFactories = await getContractsDecoderInput();
  const encodedError = process.env.ENCODED_ERROR;
  if (!encodedError || !encodedError.startsWith("0x")) {
    throw new Error("Incorrect error passed or not passed at all. Pass error string after the script name.");
  }

  return decodeCustomError({
    contractFactories,
    encodedError,
  });
};


decode()
  .then(decodedError => {
    console.log(decodedError);
    process.exit(0);
  })
  .catch(error => {
    console.error("Failed to decode error:", error);
    process.exit(1);
  });
