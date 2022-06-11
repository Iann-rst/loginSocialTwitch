import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

// interface ResponseType{
//   type: string;
//   params: {

//   }
// }

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  // Buscar o CLIENT_ID das variáveis de ambientes
  const { CLIENT_ID } = process.env;

  async function signIn() {
    try {
      setIsLoggingIn(true);

      //URL de redirecionamento 
      const REDIRECT_URI = makeRedirectUri({ useProxy: true });

      //Tipo de resposta que se espera
      const RESPONSE_TYPE = 'token';

      //permissões que você solicita do usuário ao fazer o login
      const SCOPE = encodeURI('openid user:read:email user:read:follows');

      //Sempre solicita a autorização do usuário ao logar no app
      const FORCE_VERIFY = true;

      //String aleatória que você deve gerar para aumentar a segurança do seu app
      const STATE = generateRandom(30);

      //Montar a authUrl com twitchEndpoint authorization client_id redirect_uri response_type scope force_verify e state
      const authUrl = twitchEndpoints.authorization +
        `?client_id=${CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&response_type=${RESPONSE_TYPE}` +
        `&scope=${SCOPE}` +
        `&force_verify=${FORCE_VERIFY}` +
        `&state=${STATE}`;

      const response = await startAsync({ authUrl });

      if (response.type === 'success' && response.params.error !== 'access_denied') {
        if (response.params.state !== STATE) {
          throw new Error('Invalid state value');
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${response.params.access_token}`;

        const userResponse = await api.get('/users');
        setUser({
          id: userResponse.data.data[0].id,
          display_name: userResponse.data.data[0].display_name,
          email: userResponse.data.data[0].email,
          profile_image_url: userResponse.data.data[0].profile_image_url
        });
        setUserToken(response.params.access_token);
      }
    } catch (error) {
      throw new Error()
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      //set isLoggingOut como true
      setIsLoggingOut(true);

      // call revokeAsync with access_token, client_id and twitchEndpoint revocation
      await revokeAsync({ token: userToken, clientId: CLIENT_ID }, { revocationEndpoint: twitchEndpoints.revocation });

    } catch (error) {
    } finally {
      //Set user vazio
      setUser({} as User);

      //set token vazio
      setUserToken('');

      //remove o access_token do cabeçalho da requisição
      delete api.defaults.headers.common['Authorization'];

      //set isLoggingOut como falso
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    api.defaults.headers.common['Client-Id'] = CLIENT_ID;
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
