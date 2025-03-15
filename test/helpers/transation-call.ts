import { TransactionResponse } from "ethers";
import { ZModulesContract } from "../../src/deploy";


export const executeTX = async (contract : ZModulesContract, contractCall : Promise<TransactionResponse>) => {
  try {
    const tx = await contractCall;
    await tx.wait(Number(process.env.CONFIRMATIONS_N));
  } catch (error : any) {

    const errorHash = error.data;
    const decodedErr = contract.interface.parseError(errorHash);

    if (decodedErr) {
      throw new Error(`Custom error #${error.message}: ${decodedErr.name}; Args: ${decodedErr.args}`);
    } else {
      throw new Error(`Couldn't decode the error! ${error}; ${errorHash}`);
    }
  }
};