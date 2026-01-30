import io from 'socket.io-client';
import axios from 'axios';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/thoughts';

export const socket = io(SOCKET_URL);
export const api = axios.create({ baseURL: API_URL });
export const ENDPOINT = API_URL;