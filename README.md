# Gestão de Limpeza - SME-SP

O sistema para gestão das atividades de limpeza dos ambientes das unidades escolares possui duas ferramentas:


- **Aplicativo Mobile:** de uso exclusivo dos Prestadores de Serviço para o registro da realização das atividades.
- **Retaguarda Web:** para cadastros gerais e acomapnhamento dos monitoramentos, fiscalização e faturamento.

## Backend

Desenvolvido com NodeJS + Express em versão 14.15.1.

Para executar o projeto, configurar as variáveis de ambiente conforme o arquivo **.env.example** e após executar os seguintes comandos:

- Executar o seguinte comando para criar a imagem do Docker:
```bash
  docker build -t <nome_da_imagem> .
```

- Executar o seguinte comando para criar a o container do Docker:
```bash
  docker run -d -p 3001:3001  -v <diretorio_upload_persistente>:/src/uploads --name <nome_do_container> <nome_da_imagem>
```

Para o funcionamento do recurso de agendamento automáticos dos monitoramentos, deverá ser adicionado a seguinte chamada no Crontab do servidor que executa a aplicação.

```bash
  1 0 * * * curl http://localhost:$SERVER_PORT/api/system/agendar-monitoramentos-automaticos >> $LOG_PATH/agendamento-automatico-`date +\%F`.log 2>&1
```

No quinto dia corrido de cada mês deverão ser gerados os Relatórios Gerenciais referentes ao mês imediatamente anterior, para tal deverá ser adicionado a seguinte chamada no Crontab do servidor que executa a aplicação.

```bash
  1 0 5 * * curl http://localhost:$SERVER_PORT/api/system/gerar-relatorio-gerencial >> $LOG_PATH/relatorio-gerencial-`date +\%F`.log 2>&1
```

De uma em uma hora verifica as ocorrecias que nao foram fechadas e as encerra

```bash 
  0 8-20 * * 1-5 curl http://localhost:$SERVER_PORT/api/system/fechamento-automatico-ocorrencias >> $LOG_PATH/fechamento-automatico-ocorrencias-`date +\%F`.log 2>&1
```
