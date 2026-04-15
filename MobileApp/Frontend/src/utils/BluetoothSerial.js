import RNBluetoothClassic, {
  BluetoothEventType,
} from 'react-native-bluetooth-classic';
import { PermissionsAndroid, Platform } from 'react-native';

//Getting permissions

export async function requestBluetoothPermissions() {
    if(Platform.OS == 'android'){
        const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    return true;
}

//Scanning for devices

export async function getPairedDevices(){
    try{
        const paired = await RNBluetoothClassic.getBondedDevices();
        return paired;
    } catch (error){
        console.error('Failed to get paired devices:', error);
        return [];
    }
}

//Connecting

export async function connectToDevice(address){
    try{
        const isConnected = await RNBluetoothClassic.isDeviceConnected(address);
        if(isConnected) return await RNBluetoothClassic.getConnectedDevice(address);
        const device = await RNBluetoothClassic.connectToDevice(address);
        
        console.log('Connected to device');
        return device;
    } catch (error){
        console.error('Failed to connect to device:', error);
        return null;
    }

}

//Disconnecting

export async function disconnectDevice(address){
    try{
        await RNBluetoothClassic.disconnectFromDevice(address);
        console.log('Disconnected from the device')
    } catch (error){
        console.error('Failed to disconnect from the device:', error);
    }
}

//Sending data

export async function sendData(address, message){
    try{
        await RNBluetoothClassic.writeToDevice(address, message + '\n');
    } catch(error){
        console.error('Failed to send data to device:',error);
    }
}

//Receiving data

export function receiveData(address, onData){
    const subsription = RNBluetoothClassic.onDeviceRead(address, event => {
        const message = event.data;
        onData(message);
    });
    return subsription;
}