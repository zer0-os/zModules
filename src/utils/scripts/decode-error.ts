import { ethers } from "hardhat";
import { decodeError, IContractDecoderInput } from "../error-decoder";
import { contractNames } from "../../deploy";


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

const decodeCustomError = async () => {
  const contractFactories = await getContractsDecoderInput();
  const encodedError = process.env.ENCODED_ERROR;
  if (!encodedError || !encodedError.startsWith("0x")) {
    throw new Error("Incorrect error passed or not passed at all. Pass error string after the script name.");
  }

  return decodeError({
    contractFactories,
    encodedError,
  });
};

decodeCustomError()
  .then(decodedError => {
    console.log(decodedError);
    process.exit(0);
  })
  .catch(error => {
    console.error("Error decoding file with:", error);
    process.exit(1);
  });
