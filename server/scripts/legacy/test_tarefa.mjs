// Test creating a tarefa agendada
const loginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'eduardodominikus@hotmail.com', senha: '123456' }),
});
const { token } = await loginRes.json();
console.log('Token obtained:', !!token);

// Now try to create a tarefa
const payload = {
  titulo: 'Teste tarefa',
  descricao: 'Descrição teste',
  funcionarioId: null,
  funcionarioNome: 'Teste',
  condominioId: '8149b74b-bfda-45a6-bf94-e43db83291bb',
  bloco: '',
  local: 'Hall',
  recorrencia: 'unica',
  diasSemana: [],
  dataEspecifica: '2026-03-30',
  diaMes: null,
  prioridade: 'media',
};

console.log('Sending payload:', JSON.stringify(payload, null, 2));

const res = await fetch('http://localhost:3001/api/tarefas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(payload),
});
console.log('Status:', res.status);
const data = await res.json();
console.log('Response:', JSON.stringify(data, null, 2));
