import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { BsCartCheck, BsCashStack } from "react-icons/bs";
import PageHeader from "../../components/molecules/PageHeader";

export default function DashboardCajero() {
  return (
    <>
      <PageHeader title="Dashboard de Cajero" subtitle="Operaciones del día" />
      <Container fluid className="p-3">

      <Row className="g-3">
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Body className="d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center mb-3">
                <BsCartCheck size={28} className="me-2" />
                <div>
                  <Card.Title className="mb-0">Pedidos</Card.Title>
                  <Card.Text className="text-muted mb-0">Crear y gestionar pedidos</Card.Text>
                </div>
              </div>
              <div className="text-end">
                <Button as={Link} to="/cajero/pedidos" variant="success">
                  Ir a Pedidos
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Body className="d-flex flex-column justify-content-between">
              <div className="d-flex align-items-center mb-3">
                <BsCashStack size={28} className="me-2" />
                <div>
                  <Card.Title className="mb-0">Gastos</Card.Title>
                  <Card.Text className="text-muted mb-0">Registrar gastos operativos</Card.Text>
                </div>
              </div>
              <div className="text-end">
                <Button as={Link} to="/cajero/gastos" variant="warning">
                  Ir a Gastos
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
    </>
  );
}
