import React, {Component} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableHighlight,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
  FlatList,
  ScrollView,
  AppState,
  Dimensions,
  Item,
} from 'react-native';

import BleManager from 'react-native-ble-manager';
const window = Dimensions.get('window');
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default class App extends Component {
  constructor() {
    super();

    this.state = {
      scanning: false,
      peripherals: new Map(),
      appState: '',
    };

    this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this);
    this.handleStopScan = this.handleStopScan.bind(this);
    this.handleUpdateValueForCharacteristic = this.handleUpdateValueForCharacteristic.bind(
      this,
    );
    this.handleDisconnectedPeripheral = this.handleDisconnectedPeripheral.bind(
      this,
    );
    this.handleAppStateChange = this.handleAppStateChange.bind(this);
    this.initUUID();
  }
  fullUUID(uuid) {
    if (uuid.length === 4){
      return '0000' + uuid.toUpperCase() + '-0000-1000-8000-00805F9B34FB'
    }
    if (uuid.length === 8) {
      return uuid.toUpperCase() + '-0000-1000-8000-00805F9B34FB'
    }
    return uuid.toUpperCase()
  }
  initUUID(){
    this.readServiceUUID = [];
    this.readCharacteristicUUID = [];
    this.writeWithResponseServiceUUID = [];
    this.writeWithResponseCharacteristicUUID = [];
    this.writeWithoutResponseServiceUUID = [];
    this.writeWithoutResponseCharacteristicUUID = [];
    this.nofityServiceUUID = [];
    this.nofityCharacteristicUUID = [];
  }

  //获取Notify、Read、Write、WriteWithoutResponse的serviceUUID和characteristicUUID
  getUUID(peripheralInfo){
    this.readServiceUUID = [];
    this.readCharacteristicUUID = [];
    this.writeWithResponseServiceUUID = [];
    this.writeWithResponseCharacteristicUUID = [];
    this.writeWithoutResponseServiceUUID = [];
    this.writeWithoutResponseCharacteristicUUID = [];
    this.nofityServiceUUID = [];
    this.nofityCharacteristicUUID = [];
    for(let item of peripheralInfo.characteristics){
      item.service = this.fullUUID(item.service);
      item.characteristic = this.fullUUID(item.characteristic);
      if(Platform.OS == 'android'){
        if(item.properties.Notify == 'Notify'){
          this.nofityServiceUUID.push(item.service);
          this.nofityCharacteristicUUID.push(item.characteristic);
        }
        if(item.properties.Read == 'Read'){
          this.readServiceUUID.push(item.service);
          this.readCharacteristicUUID.push(item.characteristic);
        }
        if(item.properties.Write == 'Write'){
          this.writeWithResponseServiceUUID.push(item.service);
          this.writeWithResponseCharacteristicUUID.push(item.characteristic);
        }
        if(item.properties.WriteWithoutResponse == 'WriteWithoutResponse'){
          this.writeWithoutResponseServiceUUID.push(item.service);
          this.writeWithoutResponseCharacteristicUUID.push(item.characteristic);
        }
      }else{  //ios
        for(let property of item.properties){
          if(property == 'Notify'){
            this.nofityServiceUUID.push(item.service);
            this.nofityCharacteristicUUID.push(item.characteristic);
          }
          if(property == 'Read'){
            this.readServiceUUID.push(item.service);
            this.readCharacteristicUUID.push(item.characteristic);
          }
          if(property == 'Write'){
            this.writeWithResponseServiceUUID.push(item.service);
            this.writeWithResponseCharacteristicUUID.push(item.characteristic);
          }
          if(property == 'WriteWithoutResponse'){
            this.writeWithoutResponseServiceUUID.push(item.service);
            this.writeWithoutResponseCharacteristicUUID.push(item.characteristic);
          }
        }
      }
    }
    console.log('readServiceUUID',this.readServiceUUID);
    console.log('readCharacteristicUUID',this.readCharacteristicUUID);
    console.log('writeWithResponseServiceUUID',this.writeWithResponseServiceUUID);
    console.log('writeWithResponseCharacteristicUUID',this.writeWithResponseCharacteristicUUID);
    console.log('writeWithoutResponseServiceUUID',this.writeWithoutResponseServiceUUID);
    console.log('writeWithoutResponseCharacteristicUUID',this.writeWithoutResponseCharacteristicUUID);
    console.log('nofityServiceUUID',this.nofityServiceUUID);
    console.log('nofityCharacteristicUUID',this.nofityCharacteristicUUID);
  }
  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChange);

    BleManager.start({showAlert: false});

    this.handlerDiscover = bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      this.handleDiscoverPeripheral,
    );
    this.handlerStop = bleManagerEmitter.addListener(
      'BleManagerStopScan',
      this.handleStopScan,
    );
    this.handlerDisconnect = bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      this.handleDisconnectedPeripheral,
    );
    this.handlerUpdate = bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      this.handleUpdateValueForCharacteristic,
    );

    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ).then((result) => {
        if (result) {
          console.log('Permission is OK');
        } else {
          PermissionsAndroid.requestPermission(
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ).then((result) => {
            if (result) {
              console.log('User accept');
            } else {
              console.log('User refuse');
            }
          });
        }
      });
    }
  }

  handleAppStateChange(nextAppState) {
    if (
      this.state.appState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('App has come to the foreground!');
      BleManager.getConnectedPeripherals([]).then((peripheralsArray) => {
        console.log('Connected peripherals: ' + peripheralsArray.length);
      });
    }
    this.setState({appState: nextAppState});
  }

  componentWillUnmount() {
    this.handlerDiscover.remove();
    this.handlerStop.remove();
    this.handlerDisconnect.remove();
    this.handlerUpdate.remove();
  }

  handleDisconnectedPeripheral(data) {
    let peripherals = this.state.peripherals;
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      this.setState({peripherals});
    }
    console.log('Disconnected from ' + data.peripheral);
  }

  handleUpdateValueForCharacteristic(data) {
    console.log(
      'Received data from ' +
      data.peripheral +
      ' characteristic ' +
      data.characteristic,
      data.value,
    );
  }

  handleStopScan() {
    console.log('Scan is stopped');
    this.setState({scanning: false});
  }

  startScan() {
    if (!this.state.scanning) {
      this.setState({peripherals: new Map()});
      BleManager.scan([], 3, true).then((results) => {
        console.log('Scanning...');
        this.setState({scanning: true});
      });
    }
  }

  retrieveConnected() {
    BleManager.getConnectedPeripherals([]).then((results) => {
      if (results.length == 0) {
        console.log('No connected peripherals');
      }
      console.log(results);
      var peripherals = this.state.peripherals;
      for (var i = 0; i < results.length; i++) {
        var peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        this.setState({peripherals});
      }
    });
  }

  handleDiscoverPeripheral(peripheral) {
    var peripherals = this.state.peripherals;
    if (!peripherals.has(peripheral.id)) {
      peripherals.set(peripheral.id, peripheral);
      this.setState({peripherals});
    }
  }

  test(peripheral) {
    console.info('peripheral 数据：--  ' + peripheral);
    if (peripheral) {
      if (peripheral.connected) {
        BleManager.disconnect(peripheral.id);
      } else {
        console.info('开始连接');
        BleManager.connect(peripheral.id)
          .then(() => {
            let peripherals = this.state.peripherals;
            let p = peripherals.get(peripheral.id);
            if (p) {
              p.connected = true;
              peripherals.set(peripheral.id, p);
              this.setState({peripherals});
            }
            console.log('连接到 ' + JSON.stringify(peripheral.id));

            setTimeout(() => {
              //Test read current RSSI value
              BleManager.retrieveServices(peripheral.id).then(
                (peripheralData) => {
                  console.log(
                    '11111111111111111111Retrieved peripheral services',
                    peripheralData,
                  );
                  BleManager.readRSSI(peripheral.id).then((rssi) => {
                    console.log(
                      '111111111111111111Retrieved actual RSSI value',
                      rssi,
                    );
                  });
                },
              );

              // Test using bleno's pizza example
              // https://github.com/sandeepmistry/bleno/tree/master/examples/pizza
              BleManager.retrieveServices(peripheral.id).then((peripheralInfo) => {
                this.getUUID(peripheralInfo)
                console.log("print ---------  "+JSON.stringify(peripheralInfo));
                var service = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';   //  peripheralID
                var bakeCharacteristic = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';  //serviceUUID
                var crustCharacteristic = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'; //characteristicUUID


                console.info("peripheral.id => "+peripheral.id);
                setTimeout(() => {
                  BleManager.startNotification(peripheral.id, this.nofityServiceUUID[0], this.nofityCharacteristicUUID[0]).then(() => {
                    console.log('Started notification on ' + peripheral.id);
                    setTimeout(() => {
                      BleManager.write(peripheral.id, service, crustCharacteristic, [0]).then(() => {
                        console.log('Writed NORMAL crust');
                        BleManager.write(peripheral.id, service, bakeCharacteristic, [1,95]).then(() => {
                          console.log('Writed 351 temperature, the pizza should be BAKED');
                          /*
                          var PizzaBakeResult = {
                            HALF_BAKED: 0,
                            BAKED:      1,
                            CRISPY:     2,
                            BURNT:      3,
                            ON_FIRE:    4
                          };*/
                        });
                      });

                    }, 500);
                  }).catch((error) => {
                    console.log('Notification error', error);
                  });
                }, 200);
              });

            }, 900);
          })
          .catch((error) => {
            console.log('Connection error', error);
          });
      }
    }
  }

  render() {
    const list = Array.from(this.state.peripherals.values());

    return (
      <View style={styles.container}>
        <TouchableHighlight
          style={{
            marginTop: 40,
            margin: 20,
            padding: 20,
            backgroundColor: '#ccc',
          }}
          onPress={() => this.startScan()}>
          <Text>Scan Bluetooth ({this.state.scanning ? 'on' : 'off'})</Text>
        </TouchableHighlight>
        <TouchableHighlight
          style={{
            marginTop: 0,
            margin: 20,
            padding: 20,
            backgroundColor: '#ccc',
          }}
          onPress={() => this.retrieveConnected()}>
          <Text>Retrieve connected peripherals</Text>
        </TouchableHighlight>
        <ScrollView style={styles.scroll}>
          {list.length == 0 && (
            <View style={{flex: 1, margin: 20}}>
              <Text style={{textAlign: 'center'}}>No peripherals</Text>
            </View>
          )}
          <FlatList
            data={list}
            renderItem={({item}) => {
              // console.log(item);
              // const color = item.connected ? 'green' : '#fff';
              return (
                <TouchableHighlight onPress={() => this.test(item)}>
                  <View style={[styles.row, {backgroundColor: '#fff'}]}>
                    <Text
                      style={{
                        fontSize: 12,
                        textAlign: 'center',
                        color: '#333333',
                        padding: 10,
                      }}>
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        textAlign: 'center',
                        color: '#333333',
                        padding: 10,
                      }}>
                      {item.id}
                    </Text>
                  </View>
                </TouchableHighlight>
              );
            }}
            // keyExtractor={item => item.id}
          />
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    width: window.width,
    height: window.height,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    margin: 10,
  },
  row: {
    margin: 10,
  },
});
// setTimeout(() => {
//   BleManager.startNotification(
//     peripheral.id,
//     service,
//     readAndNotiService,
//   )
//     .then(() => {
//       console.log('Started notification on ' + peripheral.id);
//       setTimeout(() => {
//         BleManager.write(
//           peripheral.id,
//           service,
//           writeService,
//           [0],
//         ).then(() => {
//           console.log('Writed NORMAL crust');
//           BleManager.write(
//             peripheral.id,
//             service,
//             writeService,
//             [1, 95],
//           ).then(() => {
//             console.log(
//               'Writed 351 temperature, the pizza should be BAKED',
//             );
//             /*
//       var PizzaBakeResult = {
//         HALF_BAKED: 0,
//         BAKED:      1,
//         CRISPY:     2,
//         BURNT:      3,
//         ON_FIRE:    4
//       };*/
//           });
//         });
//       }, 500);
//     })
//     .catch((error) => {
//       console.log('Notification error', error);
//     });
// }, 200);
