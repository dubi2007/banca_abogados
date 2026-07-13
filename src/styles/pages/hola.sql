
CREATE PROCEDURE sp_AumentarSueldo
    @IdEmpleado INT,
    @PorcentajeIncremento DECIMAL(5,2)
AS
BEGIN
    BEGIN TRANSACTION;

    UPDATE EMPLEADO
    SET Sueldo = Sueldo + (Sueldo * @PorcentajeIncremento / 100)
    WHERE IdEmpleado = @IdEmpleado;

    IF (SELECT Sueldo
        FROM EMPLEADO
        WHERE IdEmpleado = @IdEmpleado) > 7000
    BEGIN
        ROLLBACK TRANSACTION;
        PRINT 'ROLLBACK: El sueldo supera los S/7000.';
    END
    ELSE
    BEGIN
        COMMIT TRANSACTION;
        PRINT 'COMMIT: Sueldo actualizado correctamente.';
    END
END;
GO