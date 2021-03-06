type edge = { u: number; v: number; population_moving: number };
export type state = { susceptible: number; infected: number; recovered: number };

const getSum = (data: Array<number>) => data.reduce((a, b) => a + b, 0);

class model {
  recovery_rate: number; //recover rate
  transmission_rate: number; //rate transmission
  n_u: number; //portion of moved susceptible individuals from u to neighbours

  population_max: number;
  h_max: number;
  nodes_id: Array<number>;
  state_of: { [key: number]: state } = {};
  population_of: { [key: number]: number } = {};
  neighbors: Array<Array<[number, number]>>;
  infected_yesterday = 0;
  stats_for: { [key: number]: { susceptible: Array<number>; infected: Array<number>; recovered: Array<number> } } = {};

  constructor(
    recovery_rate: number,
    transmission_rate: number,
    n_u: number,
    edges: Array<edge>,
    states: Array<[number, state]>,
    population_of: { [key: number]: number }
  ) {
    this.recovery_rate = recovery_rate;
    this.transmission_rate = transmission_rate;
    this.n_u = n_u;

    this.neighbors = [];
    this.nodes_id = Array.from(new Set(edges.map(({ u, v }) => [u, v]).flat()));

    edges.forEach(({ u, v }) => {
      this.neighbors[u] = [];
      this.neighbors[v] = [];
    });

    edges.forEach(({ u, v, population_moving }) => {
      if (this.neighbors[u] == null) this.neighbors[u] = [];
      this.neighbors[u].push([v, population_moving]);
      this.neighbors[v].push([u, population_moving]);
    });

    states.forEach(([node_id, state]) => (this.state_of[node_id] = state));

    this.population_of = population_of;
    this.population_max = Math.max(...Object.values(population_of));
    this.h_max = Math.max(...Object.values(edges.map(edge => edge.population_moving)));

    this.nodes_id.forEach(node_id => {
      this.stats_for[node_id] = {
        susceptible: [this.state_of[node_id].susceptible * this.population_of[node_id]],
        infected: [this.state_of[node_id].infected * this.population_of[node_id]],
        recovered: [this.state_of[node_id].recovered * this.population_of[node_id]],
      }
    });

    const point = this.getNow(null);
    this.stats_for[32] = { susceptible: [point.susceptible], infected: [point.infected], recovered: [point.recovered] };
  }

  fI(u: number) {
    const { infected, susceptible } = this.state_of[u];
    let s1 = 0.0,
      s2 = 0.0;

    this.neighbors[u].forEach(([node, population_moving]) => {
      s1 += (this.population_of[node] / this.population_max) * (population_moving / this.h_max) * this.state_of[node].infected;
      s2 += (1.0 - population_moving / this.h_max) * (this.n_u / this.neighbors[u].length) * this.state_of[node].infected; //replace n_u with n_uv
    });

    return this.discretization(
      (1.0 - this.recovery_rate) * infected +
        this.transmission_rate * (1.0 - this.n_u) * susceptible * infected +
        this.transmission_rate * (1.0 - this.n_u) * susceptible * s1 +
        this.transmission_rate * susceptible * s2
    );
  }

  fS(u: number) {
    const { infected, susceptible } = this.state_of[u];
    let s1 = 0.0,
      s2 = 0.0;

    this.neighbors[u].forEach(([node, population_moving]) => {
      s1 += (this.population_of[node] / this.population_max) * (population_moving / this.h_max) * this.state_of[node].infected;
      s2 += (1.0 - population_moving / this.h_max) * (this.n_u / this.neighbors[u].length) * this.state_of[node].infected; //replace n_u with n_uv
    });

    return this.discretization(
      susceptible -
        this.transmission_rate * (1.0 - this.n_u) * susceptible * infected -
        this.transmission_rate * (1.0 - this.n_u) * susceptible * s1 -
        this.transmission_rate * susceptible * s2
    );
  }

  fR(u: number) {
    const { infected, recovered } = this.state_of[u];
    return this.discretization(recovered + this.recovery_rate * infected);
  }

  step() {
    const dataWithKeys = Object.entries(this.state_of).map(([name, state]) => [parseInt(name), state] as [number, state]);
    this.infected_yesterday = getSum(dataWithKeys.map(([name, state]) => state.infected * this.population_of[name]));

    const new_state: { [key: number]: state } = {};
    this.nodes_id.forEach(node => {
      new_state[node] = {
        susceptible: this.fS(node),
        infected: this.fI(node),
        recovered: 1.0 - this.fS(node) - this.fI(node),
      };
    });

    this.nodes_id.forEach(node_id => {
      this.stats_for[node_id].susceptible.push(new_state[node_id].susceptible * this.population_of[node_id]);
      this.stats_for[node_id].infected.push(new_state[node_id].infected * this.population_of[node_id]);
      this.stats_for[node_id].recovered.push(new_state[node_id].recovered * this.population_of[node_id]);
    });

    this.state_of = new_state;
  }
  discretization(x: number) {
    return Math.round(100.0 * x) / 100.0;
  }
  getNow(codeID: number | null): state {
    if (codeID == null) {
      const dataWithKeys = Object.entries(this.state_of).map(([name, state]) => [parseInt(name), state] as [number, state]);
      return {
        susceptible: getSum(dataWithKeys.map(([name, state]) => state.susceptible * this.population_of[name])),
        infected: getSum(dataWithKeys.map(([name, state]) => state.infected * this.population_of[name])),
        recovered: getSum(dataWithKeys.map(([name, state]) => state.recovered * this.population_of[name])),
      };
    }

    return {
      susceptible: this.state_of[codeID].susceptible * this.population_of[codeID],
      infected: this.state_of[codeID].infected * this.population_of[codeID],
      recovered: this.state_of[codeID].recovered * this.population_of[codeID],
    };
  }
}

export default model;
