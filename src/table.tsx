import * as R from 'ramda';
import * as React from 'react';
import {render} from 'react-dom';

const api = (path: string) => new URL(path, 'https://reisapi.ruter.no/').toString();

const test = (res: Response) => {
  if (res.status < 300) return res;
  throw new Error(res.statusText);
};

const get = (path = 'heartbeat') =>
  fetch(api(path), {
    headers: {
      'content-type': 'application/json',
    },
  })
    .then(test)
    .then(res => res.json());

const pad = (n: number): string =>
  n
    .toString()
    .padStart(2, '0')
    .valueOf();

const time = (value: string): string =>
  R.pipe((d: Date): number[] => [d.getHours(), d.getMinutes()], R.map(pad), R.join(':'))(new Date(value));

interface Data {
  color: string;
  departure: string;
  destination: string;
  expectedDeparture: string;
  info?: string;
  name: string;
  platform: string;
}

const data = (value: {}): Data => ({
  color: R.path(['Extensions', 'LineColour'], value),
  departure: R.path(['MonitoredVehicleJourney', 'MonitoredCall', 'AimedDepartureTime'], value),
  destination: R.path(['MonitoredVehicleJourney', 'DestinationName'], value),
  expectedDeparture: R.path(['MonitoredVehicleJourney', 'MonitoredCall', 'ExpectedDepartureTime'], value),
  name: R.path(['MonitoredVehicleJourney', 'PublishedLineName'], value),
  platform: R.path(['MonitoredVehicleJourney', 'MonitoredCall', 'DeparturePlatformName'], value),
});

const accumulate = (values: {}[][]) => {
  return R.pipe(R.flatten, R.map(data), R.sortBy(R.prop('departure')))(values);
};

const infoSetter = R.assoc('info');
const expected = (data: Data) =>
  data.departure !== data.expectedDeparture ? `Ny tid: ${time(data.expectedDeparture)}` : '';

const information = (data: Data) => infoSetter(expected(data), data);

const over = (key: string, fn: (s: string) => string) => R.over(R.lens(R.prop(key), R.assoc(key)), fn);

// const ruter = new Vue({
//   el: '#ruter',
//   computed: {
//     departures: function() {
//       return R.pipe(R.map(information), R.map(over('color', c => `#${c}`)), R.map(over('departure', time)))(this.ruter);
//     },
//   },
//   created: function() {
//     this.fetch();
//   },
//   data: {
//     ruter: [],
//   },
//   methods: {
//     fetch: function() {
//       // stabekk tog id 2190100 shortname STA
//       // stabekk bus id 2190101 shortname STAS
//       Promise.all(R.map(id => get(`StopVisit/GetDepartures/${id}`), ['2190100', '2190101']))
//         .then(values => (this.ruter = accumulate(values)))
//         .catch(error => console.error(error));
//     },
//   },
//   mounted: function() {
//     setInterval(this.fetch, 60 * 1000);
//   },
// });

interface RuterState {
  error: Error | null;
  ruter: any[];
}

class Ruter<P, S> extends React.Component<P, RuterState> {
  constructor(props: P) {
    super(props);

    this.handleGetData = this.handleGetData.bind(this);

    this.state = {
      error: null,
      ruter: [],
    };
  }

  componentDidMount() {
    window.setInterval(this.handleGetData, 60 * 1000);
    this.handleGetData();
  }

  handleGetData() {
    // stabekk tog id 2190100 shortname STA
    // stabekk bus id 2190101 shortname STAS
    Promise.all(R.map(id => get(`StopVisit/GetDepartures/${id}`), ['2190100', '2190101']))
      .then(values => this.setState({ruter: accumulate(values)}))
      .catch(error => this.setState({error}));
  }

  render() {
    return (
      <table id="ruter">
        <colgroup>
          <col style={{widht: '5%'}} />
          <col style={{widht: '40%'}} />
          <col style={{widht: '10%'}} />
          <col style={{widht: '15%'}} />
          <col style={{widht: '30%'}} />
        </colgroup>
        <thead>
          <tr>
            <td />
            <th>Destinasjon</th>
            <th className="number">Platform</th>
            <th>Tid</th>
            <th>Info</th>
          </tr>
        </thead>
        <tbody>
          {R.pipe(R.map(information), R.map(over('color', c => `#${c}`)), R.map(over('departure', time)))(
            this.state.ruter
          ).map((departure: Data) => {
            return (
              <tr key={`${departure.destination}:${departure.departure}`}>
                <td>
                  <span style={{backgroundColor: departure.color}}>{departure.name}</span>
                </td>
                <td>{departure.destination}</td>
                <td className="number">{departure.platform}</td>
                <td>{departure.departure}</td>
                <td>{departure.info}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}

render(<Ruter />, window.document.getElementById('ruter'));
