/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableHighlight,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
  ScrollView,
  AppState,
  FlatList,
  Dimensions,
  Button,
  SafeAreaView,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import BackgroundTimer from 'react-native-background-timer';

const window = Dimensions.get('window');

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default class App extends React.Component {
  state = {
    scanning: false,
    peripherals: new Map(),
    appState: '',
  };

  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChange);

    // eslint-disable-next-line prettier/prettier
    BleManager.start({
      showAlert: false,
      restoreIdentifierKey: 'c007625e-994d-4109-adfd-e2eb504dfa9c',
    });

    this.handlerDiscover = bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      this.handleDiscoverPeripheral,
    );

    // this.handlerStop = bleManagerEmitter.addListener(
    //   'BleManagerStopScan',
    //   () => {
    //     this.handleStopScan();
    //   },
    // );
    this.handlerDisconnect = bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      this.handleDisconnectedPeripheral,
    );
    this.handlerUpdate = bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      this.handleUpdateValueForCharacteristic,
    );

    this.handlerRestoreState = bleManagerEmitter.addListener(
      'BleManagerCentralManagerWillRestoreState',
      this.handleWillRestoreState,
    );



    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ).then(result => {
        if (result) {
          console.log('Permission is OK');
        } else {
          PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ).then(result => {
            if (result) {
              console.log('User accept');
            } else {
              console.log('User refuse');
            }
          });
        }
      });
    }

    this.scanForDevices();
  }

  handleWillRestoreState = () => {
    console.log('handlerRestoreState');
    this.scanForDevices();
  }

  handleAppStateChange = (nextAppState) => {
    const { scanning, appState } = this.state;
    if (!scanning && nextAppState !== 'inactive' && appState !== nextAppState) {
      this.scanForDevices();
    }
    this.setState({ appState: nextAppState });
  }

  componentWillUnmount() {
    this.handlerDiscover.remove();
    this.handlerStop.remove();
    this.handlerDisconnect.remove();
    this.handlerUpdate.remove();
    this.handlerRestoreState.remove();
    BackgroundTimer.stopBackgroundTimer(); //after this call all code on background stop run.

  }

  handleDisconnectedPeripheral = (data) => {
    let peripherals = this.state.peripherals;
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      this.setState({ peripherals });
    }
    console.log('Disconnected from ' + data.peripheral);
  }

  handleUpdateValueForCharacteristic = (data) => {
    console.log(
      'Received data from ' +
      data.peripheral +
      ' characteristic ' +
      data.characteristic,
      data.value,
    );
  }

  // handleStopScan = () => {
  //   console.log('Scan is stopped');
  //   this.setState && this.setState({ scanning: false });
  // }

  scanForDevices = async () => {
    if (!this.state.scanning) {
      this.setState({ scanning: true });
      BackgroundTimer.runBackgroundTimer(() => {
        this.setState({ peripherals: new Map() });
        BleManager.scan(['FE9F'], 5, true).then(results => {
          console.log('Scanning...');
        });
      }, 15000);
    }
  }

  retrieveConnected = () => {
    BleManager.getConnectedPeripherals([]).then(results => {
      if (results.length === 0) {
        console.log('No connected peripherals');
      }
      console.log(results);
      const peripherals = this.state.peripherals;
      for (let i = 0; i < results.length; i++) {
        const peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        this.setState({ peripherals });
      }
    });
  }

  handleDiscoverPeripheral = (peripheral) => {
    const peripherals = this.state.peripherals;
    console.log('Got ble peripheral', JSON.stringify(peripheral));
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }
    peripherals.set(peripheral.id, peripheral);
    this.setState({ peripherals });
  }

  test(peripheral) {
    if (peripheral) {
      if (peripheral.connected) {
        BleManager.disconnect(peripheral.id);
      } else {
        BleManager.connect(peripheral.id)
          .then(() => {
            let peripherals = this.state.peripherals;
            let p = peripherals.get(peripheral.id);
            if (p) {
              p.connected = true;
              peripherals.set(peripheral.id, p);
              this.setState({ peripherals });
            }
            console.log('Connected to ' + peripheral.id);

            setTimeout(() => {
              BleManager.retrieveServices(peripheral.id).then(
                peripheralInfo => {
                  console.log(peripheralInfo);
                  const service = '13333333-3333-3333-3333-333333333337';
                  const bakeCharacteristic =
                    '13333333-3333-3333-3333-333333330003';
                  const crustCharacteristic =
                    '13333333-3333-3333-3333-333333330001';

                  setTimeout(() => {
                    BleManager.startNotification(
                      peripheral.id,
                      service,
                      bakeCharacteristic,
                    )
                      .then(() => {
                        console.log('Started notification on ' + peripheral.id);
                        setTimeout(() => {
                          BleManager.write(
                            peripheral.id,
                            service,
                            crustCharacteristic,
                            [0],
                          ).then(() => {
                            console.log('Writed NORMAL crust');
                            BleManager.write(
                              peripheral.id,
                              service,
                              bakeCharacteristic,
                              [1, 95],
                            ).then(() => {
                              console.log(
                                'Writed 351 temperature, the pizza should be BAKED',
                              );
                            });
                          });
                        }, 500);
                      })
                      .catch(error => {
                        console.log('Notification error', error);
                      });
                  }, 200);
                },
              );
            }, 900);
          })
          .catch(error => {
            console.log('Connection error', error);
          });
      }
    }
  }

  renderItem(item) {
    const color = item.connected ? 'green' : '#fff';
    return (
      <TouchableHighlight onPress={() => this.test(item)}>
        <View style={[styles.row, { backgroundColor: color }]}>
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
              fontSize: 10,
              textAlign: 'center',
              color: '#333333',
              padding: 2,
            }}>
            RSSI: {item.rssi}
          </Text>
          <Text
            style={{
              fontSize: 8,
              textAlign: 'center',
              color: '#333333',
              padding: 2,
              paddingBottom: 20,
            }}>
            {item.id}
          </Text>
        </View>
      </TouchableHighlight>
    );
  }

  render() {
    const list = Array.from(this.state.peripherals.values());
    const btnScanTitle =
      'Scan Bluetooth (' + (this.state.scanning ? 'on' : 'off') + ')';

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          <View style={{ margin: 10 }}>
            <Button title={btnScanTitle} onPress={() => this.scanForDevices()} />
          </View>

          <View style={{ margin: 10 }}>
            <Button
              title="Retrieve connected peripherals"
              onPress={() => this.retrieveConnected()}
            />
          </View>

          <ScrollView style={styles.scroll}>
            {list.length == 0 && (
              <View style={{ flex: 1, margin: 20 }}>
                <Text style={{ textAlign: 'center' }}>No peripherals</Text>
              </View>
            )}
            <FlatList
              data={list}
              renderItem={({ item }) => this.renderItem(item)}
              keyExtractor={item => item.id}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
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
